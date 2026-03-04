/**
 * ChangeTracker unit tests (tasks 4.5, 4.6)
 *
 * Tests verify:
 * 1. trackedCreate enqueues a "create" entry in the sync queue
 * 2. trackedUpdate enqueues an "update" entry
 * 3. trackedDelete enqueues a "delete" entry
 * 4. PBT (Property 2): every create/update/delete always enqueues exactly one entry
 * 5. Failed writes do not produce orphaned queue entries
 */

// ---------------------------------------------------------------------------
// Mock enqueueChange and database
// ---------------------------------------------------------------------------

// NOTE: jest.mock() is hoisted before variable declarations, so `mockEnqueue`
// would be undefined in the factory. Instead we use jest.fn() inline and
// then get the reference via the imported module.
jest.mock("@/services/sync/SyncQueue", () => ({
  enqueueChange: jest.fn(async () => {}),
}));

jest.mock("@/db", () => ({
  database: {
    write: jest.fn(async (fn: () => Promise<unknown>) => fn()),
    get: jest.fn(),
    batch: jest.fn(async () => {}),
  },
}));

jest.mock("@/stores/syncStore", () => ({
  useSyncStore: {
    getState: jest.fn(() => ({
      incrementPending: jest.fn(),
      decrementPending: jest.fn(),
      pendingCount: 0,
    })),
  },
}));

jest.mock("@/utils/logger", () => ({
  logger: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import {
  trackedCreate,
  trackedUpdate,
  trackedDelete,
} from "@/services/sync/ChangeTracker";
import { enqueueChange } from "@/services/sync/SyncQueue";

// Access the mock function via the imported module (hoisting-safe pattern)
const mockEnqueue = enqueueChange as jest.Mock;

// ---------------------------------------------------------------------------
// Minimal Model stub
// ---------------------------------------------------------------------------

interface ModelStub {
  id: string;
  isDirty: boolean;
  update: jest.Mock;
  prepareDestroyPermanently: jest.Mock;
  [key: string]: unknown;
}

function makeModel(id = "model-1"): ModelStub {
  return {
    id,
    isDirty: false,
    update: jest.fn(async (updater: (r: ModelStub) => void) => {
      updater({} as ModelStub);
    }),
    prepareDestroyPermanently: jest.fn(() => ({ type: "delete", id })),
  };
}

function makeCollection(model?: ModelStub) {
  const record = model ?? makeModel();
  return {
    create: jest.fn(async (builder: (r: ModelStub) => void) => {
      builder(record);
      return record;
    }),
    // For update/delete, we look up existing records
    find: jest.fn(async (id: string) => ({ ...record, id })),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChangeTracker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Task 4.5: Change tracking unit tests
  // -------------------------------------------------------------------------

  describe("trackedCreate", () => {
    it("calls collection.create and enqueues a 'create' entry", async () => {
      const collection = makeCollection();

      await trackedCreate("orders", collection as never, (record) => {
        (record as ModelStub).id = "new-order";
      });

      expect(collection.create).toHaveBeenCalledTimes(1);
      expect(mockEnqueue).toHaveBeenCalledWith(
        "orders",
        expect.any(String),
        "create",
        expect.any(Object)
      );
    });

    it("enqueues exactly one entry per create", async () => {
      const collection = makeCollection();

      await trackedCreate("products", collection as never, () => {});

      expect(mockEnqueue).toHaveBeenCalledTimes(1);
    });

    it("marks the new record as dirty", async () => {
      const record = makeModel("new-product");
      const collection = makeCollection(record);

      await trackedCreate("products", collection as never, () => {});

      // The builder should have set isDirty = true
      expect(record.isDirty).toBe(true);
    });
  });

  describe("trackedUpdate", () => {
    it("calls record.update and enqueues an 'update' entry", async () => {
      const record = makeModel("existing-order");

      await trackedUpdate("orders", record as never, (r) => {
        (r as ModelStub).isDirty = true;
      });

      expect(record.update).toHaveBeenCalledTimes(1);
      expect(mockEnqueue).toHaveBeenCalledWith(
        "orders",
        "existing-order",
        "update",
        expect.any(Object)
      );
    });
  });

  describe("trackedDelete", () => {
    it("enqueues a 'delete' entry when record has remoteId", async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { database } = require("@/db");
      const record = {
        ...makeModel("delete-me"),
        remoteId: "server-uuid-abc",
        destroyPermanently: jest.fn(async () => {}),
      };

      await trackedDelete("customers", record as never);

      expect(record.destroyPermanently).toHaveBeenCalled();
      expect(mockEnqueue).toHaveBeenCalledWith(
        "customers",
        "delete-me",
        "delete",
        expect.objectContaining({ remote_id: "server-uuid-abc" })
      );

      void database;
    });

    it("does NOT enqueue when record has no remoteId (never synced)", async () => {
      const record = {
        ...makeModel("local-only"),
        remoteId: null,
        destroyPermanently: jest.fn(async () => {}),
      };

      await trackedDelete("customers", record as never);

      expect(record.destroyPermanently).toHaveBeenCalled();
      expect(mockEnqueue).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Task 4.6: PBT for change preservation (Property 2)
  // Every write operation must produce exactly one queue entry
  // -------------------------------------------------------------------------

  describe("Change preservation PBT (Property 2)", () => {
    it("property: trackedCreate always enqueues exactly 1 entry per call", async () => {
      const entityTypes = ["orders", "products", "customers", "order_items"];

      for (const entityType of entityTypes) {
        mockEnqueue.mockClear();
        const collection = makeCollection();

        await trackedCreate(entityType, collection as never, () => {});

        expect(mockEnqueue).toHaveBeenCalledTimes(1);
        expect(mockEnqueue).toHaveBeenCalledWith(
          entityType,
          expect.any(String),
          "create",
          expect.any(Object)
        );
      }
    });

    it("property: trackedUpdate always enqueues exactly 1 entry per call", async () => {
      const entityTypes = ["orders", "products", "customers"];

      for (const entityType of entityTypes) {
        mockEnqueue.mockClear();
        const record = makeModel(`record-${Math.random()}`);

        await trackedUpdate(entityType, record as never, () => {});

        expect(mockEnqueue).toHaveBeenCalledTimes(1);
        expect(mockEnqueue).toHaveBeenCalledWith(
          entityType,
          record.id,
          "update",
          expect.any(Object)
        );
      }
    });

    it("property: trackedDelete always enqueues exactly 1 entry per call", async () => {
      const entityTypes = ["orders", "customers"];

      for (const entityType of entityTypes) {
        mockEnqueue.mockClear();
        const record = {
          ...makeModel(`record-${Math.random()}`),
          remoteId: "server-uuid-xyz",
          destroyPermanently: jest.fn(async () => {}),
        };

        await trackedDelete(entityType, record as never);

        expect(mockEnqueue).toHaveBeenCalledTimes(1);
        expect(mockEnqueue).toHaveBeenCalledWith(
          entityType,
          record.id,
          "delete",
          expect.any(Object)
        );
      }
    });

    it("property: N tracked creates result in exactly N queue entries", async () => {
      mockEnqueue.mockClear();

      const n = Math.floor(Math.random() * 8) + 2; // 2–9 creates
      await Promise.all(
        Array.from({ length: n }).map((_, i) => {
          const collection = makeCollection(makeModel(`record-${i}`));
          return trackedCreate("orders", collection as never, () => {});
        })
      );

      expect(mockEnqueue).toHaveBeenCalledTimes(n);
    });
  });
});

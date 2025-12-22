"""Tests for database models."""



class TestUserModel:
    """Tests for User model."""

    def test_user_model_exists(self):
        """Test that User model can be imported."""
        from app.models import User
        assert User is not None

    def test_user_has_required_fields(self):
        """Test that User model has required fields."""
        from app.models import User
        from sqlalchemy import inspect
        mapper = inspect(User)
        columns = [c.key for c in mapper.columns]
        
        required_fields = ["id", "email", "first_name", "last_name", "status"]
        for field in required_fields:
            assert field in columns, f"Missing field: {field}"

    def test_user_status_enum_values(self):
        """Test UserStatus enum has expected values."""
        from app.models import UserStatus
        assert UserStatus.ACTIVE.value == "active"
        assert UserStatus.INACTIVE.value == "inactive"
        assert UserStatus.PENDING.value == "pending"
        assert UserStatus.SUSPENDED.value == "suspended"


class TestOrganizationModel:
    """Tests for Organization model."""

    def test_organization_model_exists(self):
        """Test that Organization model can be imported."""
        from app.models import Organization
        assert Organization is not None

    def test_organization_has_required_fields(self):
        """Test that Organization model has required fields."""
        from app.models import Organization
        from sqlalchemy import inspect
        mapper = inspect(Organization)
        columns = [c.key for c in mapper.columns]
        
        required_fields = ["id", "name", "slug", "owner_id"]
        for field in required_fields:
            assert field in columns, f"Missing field: {field}"


class TestBusinessModel:
    """Tests for Business model."""

    def test_business_model_exists(self):
        """Test that Business model can be imported."""
        from app.models import Business
        assert Business is not None

    def test_business_has_required_fields(self):
        """Test that Business model has required fields."""
        from app.models import Business
        from sqlalchemy import inspect
        mapper = inspect(Business)
        columns = [c.key for c in mapper.columns]
        
        required_fields = ["id", "name", "slug", "organization_id", "vat_rate", "currency"]
        for field in required_fields:
            assert field in columns, f"Missing field: {field}"

    def test_business_has_south_african_defaults(self):
        """Test that Business has South African defaults."""
        from app.models import Business
        from sqlalchemy import inspect
        mapper = inspect(Business)
        
        # Check default values
        currency_col = mapper.columns["currency"]
        assert currency_col.default.arg == "ZAR"
        
        country_col = mapper.columns["address_country"]
        assert country_col.default.arg == "South Africa"


class TestRoleModel:
    """Tests for Role model."""

    def test_role_model_exists(self):
        """Test that Role model can be imported."""
        from app.models import Role
        assert Role is not None

    def test_permission_enum_exists(self):
        """Test that Permission enum exists."""
        from app.models import Permission
        assert Permission is not None

    def test_permission_enum_has_expected_values(self):
        """Test that Permission enum has expected values."""
        from app.models import Permission
        
        # Check a sample of permissions
        assert Permission.USERS_VIEW.value == "users:view"
        assert Permission.PRODUCTS_CREATE.value == "products:create"
        assert Permission.ORDERS_EDIT.value == "orders:edit"
        assert Permission.INVOICES_SEND.value == "invoices:send"
        assert Permission.AI_ACCESS.value == "ai:access"

    def test_default_roles_exist(self):
        """Test that default roles are defined."""
        from app.models import DEFAULT_ROLES
        
        assert "admin" in DEFAULT_ROLES
        assert "manager" in DEFAULT_ROLES
        assert "employee" in DEFAULT_ROLES

    def test_admin_role_has_all_permissions(self):
        """Test that admin role has all permissions."""
        from app.models import DEFAULT_ROLES, Permission
        
        admin_perms = DEFAULT_ROLES["admin"]["permissions"]
        all_perms = [p.value for p in Permission]
        
        assert set(admin_perms) == set(all_perms)


class TestBusinessUserModel:
    """Tests for BusinessUser model."""

    def test_business_user_model_exists(self):
        """Test that BusinessUser model can be imported."""
        from app.models import BusinessUser
        assert BusinessUser is not None

    def test_business_user_has_required_fields(self):
        """Test that BusinessUser model has required fields."""
        from app.models import BusinessUser
        from sqlalchemy import inspect
        mapper = inspect(BusinessUser)
        columns = [c.key for c in mapper.columns]
        
        required_fields = ["id", "user_id", "business_id", "role_id", "status"]
        for field in required_fields:
            assert field in columns, f"Missing field: {field}"

    def test_business_user_status_enum_values(self):
        """Test BusinessUserStatus enum has expected values."""
        from app.models import BusinessUserStatus
        assert BusinessUserStatus.ACTIVE.value == "active"
        assert BusinessUserStatus.INVITED.value == "invited"
        assert BusinessUserStatus.INACTIVE.value == "inactive"


class TestAIModels:
    """Tests for AI persistence models."""

    def test_ai_conversation_model_exists(self):
        """Test that AIConversation model can be imported."""
        from app.models import AIConversation
        assert AIConversation is not None

    def test_ai_conversation_has_required_fields(self):
        """Test that AIConversation has required fields."""
        from app.models import AIConversation
        from sqlalchemy import inspect

        mapper = inspect(AIConversation)
        columns = [c.key for c in mapper.columns]

        required_fields = ["id", "user_id", "title", "created_at", "updated_at"]
        for field in required_fields:
            assert field in columns, f"Missing field: {field}"

    def test_ai_message_model_exists(self):
        """Test that AIMessage model can be imported."""
        from app.models import AIMessage
        assert AIMessage is not None

    def test_ai_message_has_required_fields(self):
        """Test that AIMessage has required fields."""
        from app.models import AIMessage
        from sqlalchemy import inspect

        mapper = inspect(AIMessage)
        columns = [c.key for c in mapper.columns]

        required_fields = ["id", "conversation_id", "is_user", "content", "created_at", "updated_at"]
        for field in required_fields:
            assert field in columns, f"Missing field: {field}"


class TestUserSettingsModel:
    """Tests for user settings model."""

    def test_user_settings_model_exists(self):
        """Test that UserSettings model can be imported."""
        from app.models import UserSettings
        assert UserSettings is not None

    def test_user_settings_has_required_fields(self):
        """Test that UserSettings has required fields."""
        from app.models import UserSettings
        from sqlalchemy import inspect

        mapper = inspect(UserSettings)
        columns = [c.key for c in mapper.columns]

        required_fields = ["id", "user_id", "ai_data_sharing_level", "created_at", "updated_at"]
        for field in required_fields:
            assert field in columns, f"Missing field: {field}"

    def test_ai_data_sharing_level_enum_values(self):
        """Test AIDataSharingLevel enum has expected values."""
        from app.models import AIDataSharingLevel

        assert AIDataSharingLevel.NONE.value == "none"
        assert AIDataSharingLevel.APP_ONLY.value == "app_only"
        assert AIDataSharingLevel.METRICS_ONLY.value == "metrics_only"
        assert AIDataSharingLevel.FULL_BUSINESS.value == "full_business"
        assert AIDataSharingLevel.FULL_BUSINESS_WITH_CUSTOMERS.value == "full_business_with_customers"


class TestDatabaseConfiguration:
    """Tests for database configuration."""

    def test_database_module_exists(self):
        """Test that database module can be imported."""
        from app.core.database import Base, SessionLocal, engine
        assert Base is not None
        assert SessionLocal is not None
        assert engine is not None

    def test_get_db_function_exists(self):
        """Test that get_db function exists."""
        from app.core.database import get_db
        assert callable(get_db)


class TestAlembicConfiguration:
    """Tests for Alembic migration configuration."""

    def test_alembic_ini_exists(self):
        """Test that alembic.ini exists."""
        import os
        CURRENT_FILE = os.path.abspath(__file__)
        PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(CURRENT_FILE))))
        alembic_ini = os.path.join(PROJECT_ROOT, "backend", "alembic.ini")
        assert os.path.exists(alembic_ini)

    def test_alembic_env_exists(self):
        """Test that alembic/env.py exists."""
        import os
        CURRENT_FILE = os.path.abspath(__file__)
        PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(CURRENT_FILE))))
        alembic_env = os.path.join(PROJECT_ROOT, "backend", "alembic", "env.py")
        assert os.path.exists(alembic_env)

    def test_initial_migration_exists(self):
        """Test that initial migration exists."""
        import os
        CURRENT_FILE = os.path.abspath(__file__)
        PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(CURRENT_FILE))))
        migration = os.path.join(PROJECT_ROOT, "backend", "alembic", "versions", "001_initial_schema.py")
        assert os.path.exists(migration)


class TestSeedScript:
    """Tests for database seeding script."""

    def test_seed_script_exists(self):
        """Test that seed script exists."""
        import os
        CURRENT_FILE = os.path.abspath(__file__)
        PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(CURRENT_FILE))))
        seed_script = os.path.join(PROJECT_ROOT, "backend", "scripts", "seed_db.py")
        assert os.path.exists(seed_script)

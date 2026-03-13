# Implementation Plan: Digital Signage

## Overview

This implementation plan covers the digital signage system for BizPilot, including content management, display scheduling, menu boards with real-time price updates, promotional campaigns, and offline playback capabilities. The implementation follows a backend-first approach, building the API layer before the frontend components.

## Tasks

- [ ] 1. Database Schema and Models
  - [ ] 1.1 Create database migration for signage tables
    - Create all tables: signage_displays, signage_display_groups, signage_media, signage_folders, signage_content, signage_content_versions, signage_menu_boards, signage_playlists, signage_playlist_items, signage_schedules, signage_schedule_assignments, signage_campaigns, signage_campaign_assignments, signage_analytics, signage_display_events
    - Add all indexes for performance
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 12.1_
  
  - [ ] 1.2 Create SQLAlchemy models for signage entities
    - Create models in `backend/app/models/signage/`
    - Define relationships between models
    - _Requirements: All_
  
  - [ ] 1.3 Create Pydantic schemas for API request/response
    - Create schemas in `backend/app/schemas/signage/`
    - Include validation rules for all fields
    - _Requirements: All_

- [ ] 2. Display Management Backend
  - [ ] 2.1 Implement display CRUD endpoints
    - POST /api/v1/signage/displays - register display
    - GET /api/v1/signage/displays - list displays with filtering
    - GET /api/v1/signage/displays/{id} - get display details
    - PUT /api/v1/signage/displays/{id} - update display
    - DELETE /api/v1/signage/displays/{id} - remove display
    - _Requirements: 1.1, 1.3, 1.5_
  
  - [ ] 2.2 Implement display pairing and authentication
    - POST /api/v1/signage/displays/{id}/pair - generate pairing code
    - Implement pairing code validation with expiration
    - Implement device authentication flow
    - _Requirements: 1.1, 1.2_
  
  - [ ]* 2.3 Write property test for display registration uniqueness
    - **Property 1: Display Registration Uniqueness**
    - **Validates: Requirements 1.1**
  
  - [ ]* 2.4 Write property test for display authentication
    - **Property 2: Display Authentication Validity**
    - **Validates: Requirements 1.2**
  
  - [ ] 2.5 Implement display status tracking and heartbeat
    - POST /api/v1/player/heartbeat - receive heartbeat
    - Track online/offline status based on heartbeat
    - Generate alerts for offline displays
    - _Requirements: 1.3, 1.4_
  
  - [ ] 2.6 Implement remote display commands
    - POST /api/v1/signage/displays/{id}/command - send command
    - GET /api/v1/signage/displays/{id}/screenshot - capture screenshot
    - Support restart, refresh, screenshot commands
    - _Requirements: 1.7, 11.2, 11.3_
  
  - [ ] 2.7 Implement display groups
    - CRUD endpoints for display groups
    - Support grouping displays by location, zone, tags
    - _Requirements: 1.5_

- [ ] 3. Checkpoint - Display Management
  - Ensure all display management tests pass
  - Verify display registration and pairing flow works
  - Ask the user if questions arise

- [ ] 4. Media Library Backend
  - [ ] 4.1 Implement media upload service
    - POST /api/v1/signage/media - upload media
    - Validate file type (JPEG, PNG, WebP, GIF, MP4, WebM, HTML)
    - Validate file size against configurable limits
    - Store files in S3 or configured storage
    - _Requirements: 2.1, 2.2_
  
  - [ ]* 4.2 Write property test for media type validation
    - **Property 3: Media Type Validation**
    - **Validates: Requirements 2.1, 2.2**
  
  - [ ] 4.3 Implement thumbnail and preview generation
    - Generate thumbnails for images
    - Generate preview frames for videos
    - Extract metadata (dimensions, duration)
    - _Requirements: 2.3_
  
  - [ ] 4.4 Implement media CRUD and folder management
    - GET /api/v1/signage/media - list media with filtering
    - PUT /api/v1/signage/media/{id} - update metadata
    - DELETE /api/v1/signage/media/{id} - delete media
    - CRUD for folders with nested hierarchy
    - _Requirements: 2.4, 2.5_
  
  - [ ]* 4.5 Write property test for media referential integrity
    - **Property 4: Media Referential Integrity**
    - **Validates: Requirements 2.6**
  
  - [ ] 4.6 Implement media usage tracking
    - GET /api/v1/signage/media/{id}/usage - get usage info
    - Prevent deletion of media in use
    - Track display count and play time
    - _Requirements: 2.6, 2.7_
  
  - [ ] 4.7 Implement bulk operations
    - POST /api/v1/signage/media/bulk - bulk upload
    - Bulk move, tag, delete operations
    - _Requirements: 2.8_


- [ ] 5. Content Management Backend
  - [ ] 5.1 Implement content CRUD endpoints
    - POST /api/v1/signage/content - create content
    - GET /api/v1/signage/content - list content
    - GET /api/v1/signage/content/{id} - get content details
    - PUT /api/v1/signage/content/{id} - update content
    - DELETE /api/v1/signage/content/{id} - delete content
    - _Requirements: 3.1, 3.2_
  
  - [ ] 5.2 Implement content layout validation
    - Validate zone configurations
    - Check for zone overlaps
    - Validate media and data source references
    - _Requirements: 3.2, 3.8_
  
  - [ ]* 5.3 Write property test for content zone non-overlap
    - **Property 5: Content Zone Non-Overlap**
    - **Validates: Requirements 3.2**
  
  - [ ] 5.4 Implement content versioning
    - Create version on each update
    - GET /api/v1/signage/content/{id}/versions - list versions
    - Support reverting to previous versions
    - _Requirements: 3.7_
  
  - [ ]* 5.5 Write property test for content version round-trip
    - **Property 6: Content Version Round-Trip**
    - **Validates: Requirements 3.7**
  
  - [ ] 5.6 Implement content publishing
    - POST /api/v1/signage/content/{id}/publish - publish content
    - Validate content before publishing
    - Update status to published
    - _Requirements: 3.6_
  
  - [ ] 5.7 Implement content templates
    - GET /api/v1/signage/templates - list templates
    - Pre-built templates for menu boards, promotions, welcome screens
    - _Requirements: 3.3_

- [ ] 6. Menu Board Backend
  - [ ] 6.1 Implement menu board CRUD endpoints
    - POST /api/v1/signage/menu-boards - create menu board
    - GET /api/v1/signage/menu-boards - list menu boards
    - GET /api/v1/signage/menu-boards/{id} - get menu board
    - PUT /api/v1/signage/menu-boards/{id} - update menu board
    - _Requirements: 4.1_
  
  - [ ] 6.2 Implement menu board data integration
    - Fetch products from product catalog
    - Filter by category IDs
    - Include prices, images, descriptions
    - Handle unavailable products
    - _Requirements: 4.2, 4.3, 4.4, 4.5_
  
  - [ ]* 6.3 Write property test for menu board price consistency
    - **Property 7: Menu Board Price Consistency**
    - **Validates: Requirements 4.2, 4.3**
  
  - [ ]* 6.4 Write property test for menu board category filtering
    - **Property 8: Menu Board Category Filtering**
    - **Validates: Requirements 4.4**
  
  - [ ] 6.5 Implement menu board preview
    - GET /api/v1/signage/menu-boards/{id}/preview - preview with live data
    - Support promotional pricing display
    - Support nutritional info and allergens
    - Support multiple currency formats
    - _Requirements: 4.6, 4.7, 4.8_

- [ ] 7. Checkpoint - Content and Menu Boards
  - Ensure all content and menu board tests pass
  - Verify content creation and publishing flow
  - Verify menu board displays correct product data
  - Ask the user if questions arise

- [ ] 8. Playlist Management Backend
  - [ ] 8.1 Implement playlist CRUD endpoints
    - POST /api/v1/signage/playlists - create playlist
    - GET /api/v1/signage/playlists - list playlists
    - GET /api/v1/signage/playlists/{id} - get playlist with items
    - PUT /api/v1/signage/playlists/{id} - update playlist
    - DELETE /api/v1/signage/playlists/{id} - delete playlist
    - _Requirements: 5.1, 5.2_
  
  - [ ] 8.2 Implement playlist item management
    - Add/remove/reorder playlist items
    - Support content, menu boards, and nested playlists
    - Configure duration per item
    - _Requirements: 5.1, 5.2, 5.6_
  
  - [ ]* 8.3 Write property test for playlist order preservation
    - **Property 9: Playlist Order Preservation**
    - **Validates: Requirements 5.1**
  
  - [ ] 8.4 Implement playlist priority and shuffle
    - Support priority levels for playlists
    - Support shuffle mode
    - _Requirements: 5.3, 5.4_
  
  - [ ]* 8.5 Write property test for playlist priority resolution
    - **Property 10: Playlist Priority Resolution**
    - **Validates: Requirements 5.4**
  
  - [ ] 8.6 Implement playlist duration calculation
    - Calculate total duration including nested playlists
    - Warn if exceeding recommended limits
    - _Requirements: 5.7_
  
  - [ ]* 8.7 Write property test for playlist duration calculation
    - **Property 11: Playlist Duration Calculation**
    - **Validates: Requirements 5.7**


- [ ] 9. Schedule Management Backend
  - [ ] 9.1 Implement schedule CRUD endpoints
    - POST /api/v1/signage/schedules - create schedule
    - GET /api/v1/signage/schedules - list schedules
    - GET /api/v1/signage/schedules/{id} - get schedule
    - PUT /api/v1/signage/schedules/{id} - update schedule
    - DELETE /api/v1/signage/schedules/{id} - delete schedule
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [ ] 9.2 Implement schedule evaluation engine
    - Evaluate time-based rules (start/end time)
    - Evaluate day-of-week rules
    - Evaluate date range rules
    - Support dayparting (breakfast, lunch, dinner, late-night)
    - Support timezone-aware evaluation
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.8_
  
  - [ ]* 9.3 Write property test for schedule time evaluation
    - **Property 12: Schedule Time Evaluation**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.5, 6.7, 6.8**
  
  - [ ] 9.4 Implement schedule priority resolution
    - Handle overlapping schedules
    - Apply priority rules
    - GET /api/v1/signage/schedules/timeline - get schedule timeline
    - _Requirements: 6.4_
  
  - [ ]* 9.5 Write property test for schedule priority resolution
    - **Property 13: Schedule Priority Resolution**
    - **Validates: Requirements 6.4**
  
  - [ ] 9.6 Implement schedule assignments
    - Assign schedules to displays, groups, or locations
    - Support schedule templates
    - Handle schedule expiration
    - _Requirements: 6.6, 6.7_

- [ ] 10. Campaign Management Backend
  - [ ] 10.1 Implement campaign CRUD endpoints
    - POST /api/v1/signage/campaigns - create campaign
    - GET /api/v1/signage/campaigns - list campaigns
    - GET /api/v1/signage/campaigns/{id} - get campaign
    - PUT /api/v1/signage/campaigns/{id} - update campaign
    - DELETE /api/v1/signage/campaigns/{id} - delete campaign
    - _Requirements: 7.1_
  
  - [ ] 10.2 Implement campaign lifecycle management
    - Automatic activation at start date
    - Automatic deactivation at end date
    - Status transitions (draft, scheduled, active, completed)
    - _Requirements: 7.2, 7.3_
  
  - [ ]* 10.3 Write property test for campaign lifecycle
    - **Property 14: Campaign Lifecycle Correctness**
    - **Validates: Requirements 7.2, 7.3, 7.5**
  
  - [ ] 10.4 Implement campaign approval workflow
    - POST /api/v1/signage/campaigns/{id}/approve - approve campaign
    - Require approval before activation
    - Track approver and approval time
    - _Requirements: 7.5_
  
  - [ ] 10.5 Implement campaign conflict detection
    - Detect overlapping campaigns on same displays
    - Alert on conflicts
    - _Requirements: 7.8_
  
  - [ ]* 10.6 Write property test for campaign conflict detection
    - **Property 15: Campaign Conflict Detection**
    - **Validates: Requirements 7.8**
  
  - [ ] 10.7 Implement recurring campaigns
    - Support recurrence rules (daily, weekly, monthly)
    - Generate campaign instances
    - _Requirements: 7.7_

- [ ] 11. Checkpoint - Scheduling and Campaigns
  - Ensure all schedule and campaign tests pass
  - Verify schedule evaluation works correctly
  - Verify campaign lifecycle transitions
  - Ask the user if questions arise

- [ ] 12. Location-Specific Content Backend
  - [ ] 12.1 Implement location-based content assignment
    - Assign content to specific locations
    - Support location groups
    - Integrate with multi-location-management
    - _Requirements: 8.1, 8.2_
  
  - [ ] 12.2 Implement location cascade and overrides
    - Cascade content to child locations
    - Support location-specific overrides
    - _Requirements: 8.3, 8.4_
  
  - [ ]* 12.3 Write property test for location content routing
    - **Property 16: Location Content Routing**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
  
  - [ ] 12.4 Implement location-based access control
    - Filter content by user's location access
    - Support central approval workflow
    - _Requirements: 8.6, 8.7_
  
  - [ ]* 12.5 Write property test for location access control
    - **Property 17: Location Access Control**
    - **Validates: Requirements 8.6**
  
  - [ ] 12.6 Implement location-based dynamic content
    - Support local weather, store hours, contact info
    - Inject location data into content
    - _Requirements: 8.5_


- [ ] 13. Display Player Backend API
  - [ ] 13.1 Implement player registration endpoint
    - POST /api/v1/player/register - register player device
    - Validate pairing code
    - Return device credentials
    - _Requirements: 1.1, 1.2_
  
  - [ ] 13.2 Implement player content delivery
    - GET /api/v1/player/content - get assigned content
    - GET /api/v1/player/schedule - get current schedule
    - Return content with all media URLs
    - _Requirements: 10.1_
  
  - [ ] 13.3 Implement player sync endpoint
    - GET /api/v1/player/sync - check for content updates
    - Return delta of changes since last sync
    - Support incremental sync
    - _Requirements: 10.4, 10.6_
  
  - [ ]* 13.4 Write property test for sync status accuracy
    - **Property 19: Sync Status Accuracy**
    - **Validates: Requirements 10.6**

- [ ] 14. Analytics Backend
  - [ ] 14.1 Implement analytics event recording
    - POST /api/v1/player/analytics - record analytics events
    - Track impressions, play_start, play_end events
    - Store in signage_analytics table
    - _Requirements: 12.1, 12.2_
  
  - [ ]* 14.2 Write property test for analytics impression accuracy
    - **Property 20: Analytics Impression Accuracy**
    - **Validates: Requirements 12.1, 12.2**
  
  - [ ] 14.3 Implement display uptime tracking
    - Calculate uptime from heartbeat records
    - Track online/offline periods
    - _Requirements: 12.3_
  
  - [ ]* 14.4 Write property test for display uptime calculation
    - **Property 21: Display Uptime Calculation**
    - **Validates: Requirements 12.3**
  
  - [ ] 14.5 Implement analytics query endpoints
    - GET /api/v1/signage/analytics/impressions - content impressions
    - GET /api/v1/signage/analytics/display-uptime - display uptime
    - GET /api/v1/signage/analytics/content-performance - content performance
    - Support filtering by content, display, location, time period
    - _Requirements: 12.4_
  
  - [ ] 14.6 Implement analytics export
    - GET /api/v1/signage/analytics/export - export data
    - Support CSV and PDF formats
    - _Requirements: 12.5_
  
  - [ ] 14.7 Implement campaign analytics
    - GET /api/v1/signage/campaigns/{id}/analytics - campaign analytics
    - Track impressions and display time per campaign
    - _Requirements: 7.6_

- [ ] 15. Checkpoint - Backend Complete
  - Ensure all backend tests pass
  - Verify all API endpoints work correctly
  - Run full integration test suite
  - Ask the user if questions arise

- [ ] 16. Frontend - Signage Dashboard
  - [ ] 16.1 Create signage dashboard page
    - Create `frontend/src/app/signage/page.tsx`
    - Display overview of displays, content, campaigns
    - Show alerts and status summary
    - _Requirements: 11.1_
  
  - [ ] 16.2 Create display management pages
    - Create `frontend/src/app/signage/displays/page.tsx` - display list
    - Create `frontend/src/app/signage/displays/[id]/page.tsx` - display details
    - Show display status, current content, settings
    - Support remote commands (restart, refresh, screenshot)
    - _Requirements: 1.3, 1.7, 11.1, 11.2, 11.3_
  
  - [x] 16.3 Create DisplayCard component
    - Create `frontend/src/components/signage/DisplayCard.tsx`
    - Show display status, thumbnail, last heartbeat
    - Support quick actions
    - _Requirements: 1.3, 11.1_

- [ ] 17. Frontend - Media Library
  - [ ] 17.1 Create media library page
    - Create `frontend/src/app/signage/media/page.tsx`
    - Grid view of media with thumbnails
    - Folder navigation
    - Search and filter by tags
    - _Requirements: 2.4, 2.5_
  
  - [x] 17.2 Create MediaUploader component
    - Create `frontend/src/components/signage/MediaUploader.tsx`
    - Drag-and-drop upload
    - Progress indicator
    - Bulk upload support
    - _Requirements: 2.1, 2.8_
  
  - [ ] 17.3 Implement media detail view
    - Show media preview, metadata, usage info
    - Edit tags and metadata
    - _Requirements: 2.5, 2.6, 2.7_

- [ ] 18. Frontend - Content Editor
  - [ ] 18.1 Create content list page
    - Create `frontend/src/app/signage/content/page.tsx`
    - List content with status, preview thumbnails
    - Filter by status, type
    - _Requirements: 3.1_
  
  - [x] 18.2 Create ContentEditor component
    - Create `frontend/src/components/signage/ContentEditor.tsx`
    - Visual layout editor with zones
    - Drag-and-drop media placement
    - Text overlay configuration
    - Transition settings
    - _Requirements: 3.1, 3.2, 3.4, 3.5_
  
  - [ ] 18.3 Create content editor page
    - Create `frontend/src/app/signage/content/new/page.tsx`
    - Create `frontend/src/app/signage/content/[id]/page.tsx`
    - Template selection
    - Preview at display resolution
    - Publish workflow
    - _Requirements: 3.3, 3.6, 3.7_

- [ ] 19. Frontend - Menu Board Editor
  - [ ] 19.1 Create menu board list page
    - Create `frontend/src/app/signage/menu-boards/page.tsx`
    - List menu boards with previews
    - _Requirements: 4.1_
  
  - [x] 19.2 Create MenuBoardEditor component
    - Create `frontend/src/components/signage/MenuBoardEditor.tsx`
    - Template selection
    - Category selection
    - Styling configuration
    - Live preview with product data
    - _Requirements: 4.1, 4.3, 4.4, 4.6, 4.7, 4.8_
  
  - [ ] 19.3 Create menu board editor page
    - Create `frontend/src/app/signage/menu-boards/[id]/page.tsx`
    - Full menu board configuration
    - Preview with real product data
    - _Requirements: 4.1_


- [ ] 20. Frontend - Playlist and Schedule Management
  - [ ] 20.1 Create playlist management page
    - Create `frontend/src/app/signage/playlists/page.tsx`
    - List playlists with item count, duration
    - _Requirements: 5.1_
  
  - [x] 20.2 Create PlaylistBuilder component
    - Create `frontend/src/components/signage/PlaylistBuilder.tsx`
    - Drag-and-drop item ordering
    - Duration configuration per item
    - Nested playlist support
    - Shuffle and priority settings
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_
  
  - [ ] 20.3 Create schedule management page
    - Create `frontend/src/app/signage/schedules/page.tsx`
    - List schedules with status
    - _Requirements: 6.1_
  
  - [x] 20.4 Create ScheduleCalendar component
    - Create `frontend/src/components/signage/ScheduleCalendar.tsx`
    - Calendar view of schedules
    - Time slot visualization
    - Conflict highlighting
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [ ] 20.5 Create schedule editor
    - Time range configuration
    - Day-of-week selection
    - Date range selection
    - Daypart selection
    - Display/group assignment
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.6_

- [ ] 21. Frontend - Campaign Management
  - [ ] 21.1 Create campaign management page
    - Create `frontend/src/app/signage/campaigns/page.tsx`
    - List campaigns with status, dates
    - Filter by status
    - _Requirements: 7.1_
  
  - [x] 21.2 Create CampaignTimeline component
    - Create `frontend/src/components/signage/CampaignTimeline.tsx`
    - Timeline visualization of campaigns
    - Conflict indicators
    - _Requirements: 7.1, 7.8_
  
  - [ ] 21.3 Create campaign editor
    - Date range selection
    - Content/playlist assignment
    - Display targeting
    - Approval workflow UI
    - Recurrence configuration
    - _Requirements: 7.1, 7.4, 7.5, 7.7_

- [ ] 22. Frontend - Analytics Dashboard
  - [ ] 22.1 Create analytics dashboard page
    - Create `frontend/src/app/signage/analytics/page.tsx`
    - Overview metrics (impressions, uptime, performance)
    - _Requirements: 12.1, 12.2, 12.3_
  
  - [x] 22.2 Create AnalyticsCharts component
    - Create `frontend/src/components/signage/AnalyticsCharts.tsx`
    - Impressions over time chart
    - Content performance chart
    - Display uptime chart
    - _Requirements: 12.6_
  
  - [ ] 22.3 Implement analytics filtering and export
    - Filter by content, display, location, date range
    - Export to CSV/PDF
    - _Requirements: 12.4, 12.5_

- [ ] 23. Checkpoint - Frontend Complete
  - Ensure all frontend components render correctly
  - Verify all pages load and display data
  - Test user workflows end-to-end
  - Ask the user if questions arise

- [ ] 24. Display Player Application
  - [ ] 24.1 Create display player project structure
    - Create `player/` directory
    - Set up React/TypeScript project
    - Configure for web and Electron builds
    - _Requirements: 10.1_
  
  - [ ] 24.2 Implement PlayerService
    - Create `player/src/services/PlayerService.ts`
    - Handle registration and authentication
    - Manage heartbeat sending
    - Process remote commands
    - _Requirements: 1.2, 1.3, 1.7_
  
  - [ ] 24.3 Implement CacheService
    - Create `player/src/services/CacheService.ts`
    - Cache content and media locally (IndexedDB)
    - Manage cache storage limits
    - Prioritize high-priority content
    - _Requirements: 10.1, 10.2, 10.7_
  
  - [ ]* 24.4 Write property test for offline cache availability
    - **Property 18: Offline Cache Availability**
    - **Validates: Requirements 10.1, 10.3**
  
  - [ ] 24.5 Implement SyncService
    - Create `player/src/services/SyncService.ts`
    - Check for content updates
    - Download new content
    - Handle sync on reconnection
    - _Requirements: 10.4, 10.6_
  
  - [ ] 24.6 Implement ContentRenderer component
    - Create `player/src/components/ContentRenderer.tsx`
    - Render content layouts with zones
    - Support images, videos, HTML, text
    - Handle transitions
    - _Requirements: 3.2, 3.4, 3.5_
  
  - [ ] 24.7 Implement MenuBoardRenderer component
    - Create `player/src/components/MenuBoardRenderer.tsx`
    - Render menu board with live product data
    - Handle unavailable products
    - Support promotional pricing
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6_
  
  - [ ] 24.8 Implement schedule evaluation in player
    - Evaluate schedules locally
    - Determine current content to display
    - Handle schedule transitions
    - _Requirements: 6.1, 6.4, 6.7_
  
  - [ ] 24.9 Implement AnalyticsService
    - Create `player/src/services/AnalyticsService.ts`
    - Track impressions and play time
    - Queue analytics for upload
    - Send analytics to backend
    - _Requirements: 12.1, 12.2_
  
  - [ ] 24.10 Implement offline fallback
    - Display fallback content when cache empty
    - Show offline indicator
    - _Requirements: 10.3, 10.5_

- [ ] 25. Final Integration and Testing
  - [ ] 25.1 End-to-end integration testing
    - Test complete flow: create content → assign to display → verify playback
    - Test schedule-based content switching
    - Test campaign activation/deactivation
    - Test offline playback scenario
    - _Requirements: All_
  
  - [ ] 25.2 Multi-location testing
    - Test location-specific content distribution
    - Test location cascade and overrides
    - Test location-based access control
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6_
  
  - [ ] 25.3 Performance testing
    - Test with 100+ displays
    - Test large media uploads
    - Test analytics queries on large datasets
    - _Requirements: 11.1, 12.4_

- [ ] 26. Final Checkpoint
  - Ensure all tests pass
  - Verify all requirements are implemented
  - Review analytics accuracy
  - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional property-based tests that can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- The display player can be built as a web app initially, with Electron packaging added later
- Multi-location features depend on the multi-location-management spec being implemented

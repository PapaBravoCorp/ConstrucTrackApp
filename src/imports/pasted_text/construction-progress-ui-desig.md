Build a mobile-first and web-capable UI design for a real-estate construction progress tracking system that supports both Site Agent and Project Manager/Client roles and an Admin/Operations role for project creation, role assignment, and template management.

Visual Style:

Clean, professional look engineered for construction/real estate fields.
Base palette: White backgrounds, neutral greys, subtle construction-accent color (deep blue or orange).
Typography: Use modern, readable fonts (Poppins, Inter, or similar).
UI components: Use cards, progress bars, thumbnails, minimal iconography, mobile-friendly touches.

Roles & Capabilities:

Admin / Operations
Create new projects (enter project name, location/address, type [residential/commercial], start/end dates, assigned client).
Define Project Templates: select list of milestones/phases (e.g., Mobilisation, Foundation, Structure, Roofing, MEP, Finishing, Handover) and default % weights if desired.
Assign roles/users to each project: choose from users list and assign roles (Site Agent, Project Manager, Client Viewer). A single user can have different roles in different projects.
View user list, role assignments, project-user mapping, change access.
Templates library: Manage templates (create/edit/delete) for milestone lists, default phases, default durations or expected % completion by date.
Access control: Define role permissions (which role can edit updates, view photos, assign tasks, etc.).
Project Manager / Client
View dashboard listing all assigned projects with key metrics: overall % completion, status (On Track / Delayed / Completed), last update time.
Filter and search projects.
Click into a project: view milestone list, % for each milestone, photo gallery, history of updates.
View role assignments and agents working on the project.
Monitor if any milestone is behind schedule (e.g., actual % < planned % by date).
Receive notifications/alerts if no update received in X days, or milestone delayed.
Site Agent (Field Mobile)
Login with mobile device; offline support for update capture.
On home: list of assigned projects. Select project → list of milestones (pre-populated by the template defined for that project).
For each milestone: see current % done, last update, thumbnail of last photo.
Update progress: select milestone, input new % done (slider or numeric), upload photo(s) or short video, optional remark, auto-capture GPS & timestamp. Submit.
History view: see prior updates for that milestone (date, % done, agent name, thumbnail).

Navigation & Flow:

Admin Home → Projects List → “Create Project” screen → Project Setup form → assign users/roles → save → flows back to Projects List.
Admin → Templates Library → “Create Template” screen → define phases/milestones → save.
Manager Home Dashboard → Project List → select Project → Project Detail view → Milestone list → select milestone → see history/photos.
Site Agent Home → Project List → select Project → Milestone list → “+ Update” → Update Form → Submit → back to Milestones list.
Notifications screen accessible from top bar for Manager/Client and Admin.
Profile/Settings screen for all roles (edit profile, switch projects, logout).

Key Screens:

Login/Role-Selection
Admin – Projects List, Create/Edit Project Form, Templates Library, Assign Roles
Manager – Dashboard (cards of projects), Project List, Project Detail (Milestones + Gallery), Notifications
Site Agent – Projects List, Project Detail (Milestones), Update Progress Form, History View
Profile/Settings – common for all roles

Components to include:

Project Card: name, address, % completion bar, status badge
Milestone Row: milestone name, % done, last update date, thumbnail
Progress Bar / Slider: visually show % done
Photo Upload Tile: tap to add, preview existing photos
Role Assignment Modal/Dialog: select user, select role, assign to project
Template Editor: list of phases with drag-reorder, default % weights or durations
Notification List Item: project name, milestone, alert type (delay/no update), timestamp
Onboarding/First-Time Setup screen (optional)

Design Goals & Constraints:

Agent mobile workflow: actions < 60 seconds (select project → update → submit).
Offline capability: mobile screens should suggest “Saved locally. Will sync when online.”
Scalability: anticipate dozens/hundreds of sites/projects; UI must allow search/filter, bulk actions (Admin).
Quality & trust: updates must display metadata (agent name, timestamp, GPS, photos) so client trusts the data.
Simplicity: avoid overwhelming the field agent with too many optional fields.
Role clarity: UI should adapt per role so each user sees only what they need.

Generate a connected flow for mobile and web, ensuring consistent design system (colors, typography, components). Include navigation links/arrows and annotate major components (Project Card, Milestone Row, etc.). Make sure the Admin part (project creation & templates) is included in full.

Bonus: Build a reusable component library (cards, lists, forms, modals) that can be used across screens.
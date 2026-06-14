# LMS Admin Enhancements — PRD + UX + Edge Case Analysis

**Date:** 2026-06-07
**Agents:** John (PM), Mary (Analyst), Sally (UX), Edge Case Hunter
**Status:** Ready for implementation

---

## Executive Summary

Six enhancements to the LMS admin module that improve content management UX, prevent data duplication in storage, and add missing CRUD completeness. All features share the existing Angular facade/store/service architecture and MinIO storage backend.

---

## Feature 1: Admin Course Preview

### Problem
Admins create/edit courses but cannot see how students will experience them. They must publish a course (making it visible) just to check layout — risky for incomplete content.

### User Stories

**US-1.1** As an admin, I want to preview a full course page so I can verify how it looks to students before publishing.
- **AC:** "Preview" button appears in course-edit header for all statuses
- **AC:** Preview opens in a full-screen overlay/route showing the student view (title, description, image, lesson list)
- **AC:** Preview uses the same styling as `libs/public/components/course-preview/` but without auth gate
- **AC:** Admin can close preview and return to edit mode

**US-1.2** As an admin, I want to preview individual lessons so I can verify video embeds, images, and text content render correctly.
- **AC:** Each lesson row in course-edit has a "Preview" (Eye) icon button
- **AC:** Lesson preview opens in a modal or overlay showing the student lesson view (title, video/YouTube embed, image, text content, trigger warning)
- **AC:** Preview reuses styling from `libs/person/components/lesson-detail/` without progress/completion UI
- **AC:** Admin can close and return to edit

### Priority: P1 (High)

### UX Specification

**Course Preview:**
- Button placement: course-edit header, next to status actions
- Icon: `Eye` with label "Preview"
- Opens as a route: `/staff/courses/:id/preview`
- Layout: reuses `course-preview` template structure (title, description, tags, sidebar with image, lesson list)
- Differences from public: no "Start Course" CTA, no auth modal, no lock icons — all lessons visible
- Top bar: blue banner "Preview Mode" with "Back to Edit" button

**Lesson Preview:**
- Button placement: lesson row actions, before Edit button
- Icon: `Eye` (size 14)
- Opens as a modal with max-width 800px
- Layout: reuses `lesson-detail` template structure (title, video embed, image, text content)
- Differences from student: no sidebar navigation, no complete/next buttons, no progress
- If `hasTriggerWarning`: show warning banner as student sees it
- YouTube detection: same `extractYoutubeId()` logic as person lesson-detail

### Edge Cases
- **Draft lesson with empty content** — preview shows empty state: "No content yet"
- **Video URL invalid** — preview shows broken embed gracefully, not crash
- **Image URL from MinIO unavailable** — show placeholder, not broken img
- **Very long text content** — preview must scroll, not overflow
- **Lesson with no videoUrl/imageUrl/content** — show "This lesson has no content yet" message

---

## Feature 2: Course Deletion with Confirmation Modal

### Problem
Backend `softDelete` exists (archives + 90-day grace period) but frontend has no delete button or confirmation. Admins cannot remove courses from the UI.

### User Stories

**US-2.1** As an admin, I want to delete a course with a confirmation dialog so I don't accidentally remove active content.
- **AC:** Delete button (Trash2 icon, danger variant) appears in course-edit header for HIDDEN and DRAFT courses
- **AC:** Delete button does NOT appear for PUBLISHED courses (must hide first)
- **AC:** Clicking delete opens a confirmation modal with course title and warning text
- **AC:** Modal shows enrollment count: "This course has N enrolled students"
- **AC:** Confirm button triggers `facade.deleteCourse(id)` then navigates to course list
- **AC:** Cancel closes the modal with no side effects

### Priority: P1 (High)

### UX Specification

**Delete Button:**
- Location: course-edit header-actions, rightmost position
- Variant: `danger` (or `secondary` with red icon)
- Icon: `Trash2` size 14
- Label: "Delete" (transloco key: `admin.deleteCourse`)
- Visible only when `course.status === 'HIDDEN' || course.status === 'DRAFT'`

**Confirmation Modal:**
- Title: "Delete Course?" (transloco: `admin.deleteCourseConfirm`)
- Body: 
  ```
  Are you sure you want to delete "{course.title}"?
  
  This course has {enrollmentsCount} enrolled students.
  The course will be archived with a 90-day grace period.
  ```
- Footer: Cancel (secondary) + Delete (danger/primary with Trash2 icon)
- Loading state on Delete button during API call

### Edge Cases
- **Course with active enrollments** — warning text mentions count, but deletion still allowed (soft delete with grace period)
- **Course with 0 lessons** — deletion allowed, no special warning
- **PUBLISHED course** — delete button hidden; admin must change to HIDDEN/DRAFT first
- **ARCHIVED course** — delete button hidden (already archived)
- **Network error during delete** — show error message in modal, don't close modal
- **Double-click on delete** — loading state on button prevents double submission
- **Navigate away during delete** — store handles completion in background

---

## Feature 3: File Deletion from Lesson

### Problem
Admins can upload images to lessons but cannot remove them. Once an imageUrl is set, the only workaround is clearing the text field manually (which doesn't delete the file from MinIO).

### User Stories

**US-3.1** As an admin, I want to remove an uploaded image from a lesson with a confirmation dialog so I can fix mistakes and free storage.
- **AC:** When lessonModel.imageUrl is set, a "Remove" button (X icon) appears next to the image URL field
- **AC:** Clicking remove opens a confirmation modal: "Remove this image?"
- **AC:** Confirm clears `lessonModel.imageUrl` and calls `DELETE /api/storage/{key}` to remove from MinIO
- **AC:** Cancel closes modal, image stays

### Priority: P2 (Medium)

### UX Specification

**Remove Button:**
- Position: inline with imageUrl input, right side
- Icon: `X` size 14, color `var(--sai-error)`
- Only visible when `lessonModel().imageUrl` is non-empty
- Tooltip: "Remove image"

**Confirmation Modal:**
- Title: "Remove Image?"
- Body: Shows thumbnail preview of the image + "This will permanently delete the file from storage."
- Footer: Cancel (secondary) + Remove (danger)

**After Removal:**
- imageUrl field clears
- File input resets
- Toast/inline success message: "Image removed"

### Edge Cases
- **Image URL is external (not MinIO)** — only clear the field, don't call DELETE (check if URL starts with S3_ENDPOINT)
- **Image URL manually typed (not uploaded)** — same as above, just clear field
- **MinIO file already deleted** — ignore 404 from DELETE, still clear the field
- **Image used by multiple lessons** — with dedup (Feature 5), same file key could be referenced by multiple lessons. Need reference counting or accept orphaned files
- **Delete fails (network)** — show error, keep imageUrl so admin can retry

---

## Feature 4: Form Reset on Modal Close

### Problem
When admin closes create-course or lesson modals, form state persists. Reopening shows stale data from the previous interaction.

### Current State Analysis
- `openCreateModal()` already resets `createCourseModel` to `{ title: '', description: '' }` — **this works correctly**
- `openLessonModal()` without argument already resets `lessonModel` — **this works correctly**
- `openLessonModal(lesson)` populates from lesson data — **this works correctly**
- `closeLessonModal()` sets `showLessonModal(false)` and clears `editingLesson` — but does NOT reset `lessonModel`
- `closeCreateModal()` sets `showCreateModal(false)` — but does NOT reset `createCourseModel`

### User Stories

**US-4.1** As an admin, I want forms to reset when I close modals so stale data doesn't appear when I reopen them.
- **AC:** Closing lesson modal resets `lessonModel` to defaults
- **AC:** Closing create-course modal resets `createCourseModel` to defaults
- **AC:** File input in lesson modal resets on close
- **AC:** Uploading state resets on close (`isUploading` set to false)

### Priority: P1 (High) — Bug fix

### Implementation

Minimal changes in `course-manage-facade.service.ts`:

```typescript
closeLessonModal(): void {
  this.showLessonModal.set(false);
  this.editingLesson.set(null);
  this.lessonModel.set({
    title: '',
    content: '',
    contentType: 'TEXT',
    videoUrl: '',
    imageUrl: '',
    hasTriggerWarning: false,
  });
  this.isUploading.set(false);
}

closeCreateModal(): void {
  this.showCreateModal.set(false);
  this.createCourseModel.set({ title: '', description: '' });
}
```

### Edge Cases
- **Close during active upload** — cancel upload subscription, reset isUploading
- **Close with unsaved changes** — no confirmation needed (forms are simple, data isn't lost from DB)
- **ESC key close** — triggers same `(closed)` event on ui-modal, same reset happens
- **Backdrop click close** — same as ESC

---

## Feature 5: File Deduplication in MinIO

### Problem
Every upload generates a new UUID key. If the same image is uploaded 10 times, 10 copies exist in MinIO. This wastes storage and makes management harder.

### User Stories

**US-5.1** As a system, I should detect duplicate files by content hash so the same file isn't stored multiple times.
- **AC:** Before uploading, compute SHA-256 hash of file content
- **AC:** Check if a file with this hash already exists (via metadata or DB lookup)
- **AC:** If exists: return the existing file's URL without uploading again
- **AC:** If new: upload normally, store hash in metadata

**US-5.2** As an admin, when I paste an existing storage URL in the imageUrl field, the system validates it exists.
- **AC:** If URL matches the S3 endpoint pattern, validate the key exists via HEAD request
- **AC:** Show green checkmark if file exists, red warning if not

### Priority: P3 (Low) — Nice-to-have for MVP

### Technical Design

**Option A: Prisma file registry table (Recommended)**
```prisma
model StorageFile {
  id        String   @id @default(uuid())
  key       String   @unique
  hash      String   // SHA-256 of content
  mimeType  String
  size      Int
  refCount  Int      @default(1)
  createdAt DateTime @default(now())

  @@index([hash])
}
```

**Upload flow:**
1. Compute `SHA-256(file.buffer)` 
2. Query `StorageFile` by hash
3. If found: increment `refCount`, return existing `{ key, url }`
4. If not found: upload to MinIO, create `StorageFile` record, return new `{ key, url }`

**Delete flow:**
1. Find `StorageFile` by key
2. Decrement `refCount`
3. If `refCount === 0`: delete from MinIO + delete DB record
4. If `refCount > 0`: only unlink, don't delete actual file

### Edge Cases
- **Same content, different filename** — hash matches, reuse (correct behavior)
- **Same filename, different content** — hash differs, upload as new (correct behavior)
- **Hash collision (SHA-256)** — practically impossible (1 in 2^256)
- **Concurrent uploads of same file** — use `upsert` with hash as unique constraint to handle race
- **Migration of existing files** — existing files have no hash; compute lazily on next access or batch migrate
- **refCount goes negative** — clamp to 0, delete file
- **File exists in DB but deleted from MinIO** — re-upload, update record

---

## Feature 6: File Management Screen

### Problem
No UI exists to browse, search, or manage uploaded files. Admins can't see what's stored, find orphaned files, or clean up storage.

### User Stories

**US-6.1** As an admin, I want a file management screen to browse all uploaded files.
- **AC:** New route: `/staff/files`
- **AC:** Grid/list view showing file thumbnails (images) or type icons (PDF, video)
- **AC:** Each file shows: filename/key, size, upload date, MIME type
- **AC:** Pagination or infinite scroll for large collections

**US-6.2** As an admin, I want to search and filter files.
- **AC:** Search by filename/key
- **AC:** Filter by MIME type (images, documents, videos)
- **AC:** Sort by date (newest/oldest) or size

**US-6.3** As an admin, I want to delete files from the management screen.
- **AC:** Select one or multiple files
- **AC:** Delete with confirmation modal
- **AC:** Modal shows file count and total size
- **AC:** If file is referenced by lessons (dedup refCount > 0): warning "This file is used by N lessons"

**US-6.4** As an admin, I want to copy a file's URL so I can paste it into lesson forms.
- **AC:** "Copy URL" button on each file
- **AC:** Copies presigned URL to clipboard
- **AC:** Toast notification: "URL copied"

### Priority: P2 (Medium)

### UX Specification

**Layout:**
- New sidebar nav item: "Files" with `Folder` icon, under "Courses"
- Page header: "File Management" + Upload button
- View toggle: Grid (default) / List
- Filter bar: search input + MIME type dropdown + sort dropdown

**Grid View:**
- Cards with thumbnail preview (images) or icon (PDF/video/text)
- File key (truncated), size, date below thumbnail
- Hover: shows action buttons (Copy URL, Delete)

**List View:**
- Table: Thumbnail | Key | Type | Size | Date | Actions
- Sortable columns

**Delete Confirmation:**
- Title: "Delete N file(s)?"
- Body: total size, reference count warning if applicable
- Footer: Cancel + Delete (danger)

### Backend Requirements

New endpoint needed:
```
GET /api/storage/files?search=&mimeType=&sort=date&order=desc&skip=0&take=20
```
Returns: `{ data: StorageFile[], total: number }`

This requires the `StorageFile` table from Feature 5.

### Edge Cases
- **Thousands of files** — pagination mandatory, lazy-load thumbnails
- **Non-image files** — show MIME-type icon, not thumbnail
- **Deleting file used by lesson** — warn but allow (lesson will show broken image)
- **Upload from file manager** — reuse existing upload endpoint
- **Presigned URL expiry** — URLs valid 1 hour; show warning if user copies for external use
- **MinIO down** — show error state, disable uploads, show cached file list from DB
- **File too large for thumbnail** — generate server-side thumbnail or use placeholder
- **Concurrent deletion** — handle 404 gracefully if already deleted

---

## Implementation Priority Matrix

| # | Feature | Priority | Effort | Dependencies | Sprint |
|---|---------|----------|--------|-------------|--------|
| 4 | Form Reset on Modal Close | P1 | XS (30 min) | None | 1 |
| 2 | Course Delete + Confirmation | P1 | S (2-3 hrs) | None | 1 |
| 1 | Course & Lesson Preview | P1 | M (4-6 hrs) | None | 1 |
| 3 | File Deletion from Lesson | P2 | S (2-3 hrs) | None | 1 |
| 5 | File Deduplication | P3 | M (4-6 hrs) | DB migration | 2 |
| 6 | File Management Screen | P2 | L (8-12 hrs) | Feature 5 | 2 |

### Sprint 1 (Immediate): Features 4, 2, 1, 3
- No backend changes needed (except minor for Feature 3)
- All frontend work in existing components

### Sprint 2 (Next): Features 5, 6
- Requires Prisma migration (StorageFile table)
- New route, components, backend endpoints

---

## Shared UI Components Needed

| Component | Exists? | Used By |
|-----------|---------|---------|
| `ui-modal` | Yes | Features 2, 3, 6 |
| `ui-button` (danger variant) | Check | Features 2, 3, 6 |
| `ui-badge` | Yes | Feature 1 |
| `ui-icon` (Eye, Trash2, X, Copy) | Yes | All features |
| Confirmation modal (reusable) | **No — create** | Features 2, 3, 6 |

### Recommendation: Create Reusable Confirm Modal

Since three features need confirmation dialogs, create a shared component:

```
libs/shared/ui/src/components/confirm-modal/
  confirm-modal.component.ts
  confirm-modal.component.html
  confirm-modal.component.scss
```

**API:**
```typescript
@Input() isOpen: boolean;
@Input() title: string;
@Input() message: string;
@Input() confirmLabel: string = 'Confirm';
@Input() confirmVariant: 'primary' | 'danger' = 'danger';
@Input() isLoading: boolean = false;
@Output() confirmed = new EventEmitter<void>();
@Output() cancelled = new EventEmitter<void>();
```

---

## i18n Keys Required

```json
{
  "admin": {
    "preview": "Preview",
    "previewCourse": "Preview Course",
    "previewLesson": "Preview Lesson",
    "previewMode": "Preview Mode",
    "backToEdit": "Back to Edit",
    "deleteCourse": "Delete",
    "deleteCourseConfirm": "Delete Course?",
    "deleteCourseMessage": "Are you sure you want to delete \"{title}\"?",
    "deleteCourseEnrollments": "This course has {count} enrolled students.",
    "deleteCourseGracePeriod": "The course will be archived with a 90-day grace period.",
    "removeImage": "Remove Image",
    "removeImageConfirm": "Remove this image?",
    "removeImageMessage": "This will permanently delete the file from storage.",
    "imageRemoved": "Image removed",
    "urlCopied": "URL copied to clipboard",
    "fileManagement": "File Management",
    "uploadFile": "Upload File",
    "copyUrl": "Copy URL",
    "deleteFiles": "Delete {count} file(s)?",
    "deleteFilesMessage": "Total size: {size}. This action cannot be undone.",
    "fileInUse": "This file is used by {count} lesson(s).",
    "noContent": "No content yet",
    "gridView": "Grid View",
    "listView": "List View"
  }
}
```

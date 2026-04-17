
The user identified a bug in `src/pages/import/HandwrittenImport.tsx` (note: filename is `HandwrittenImport.tsx`, not `HandwrittenImportPage.tsx`). The signed URL fetch is wrapped in `useState(() => {...})` which is incorrect — `useState` initializers run once on mount and the return value is used as state, not as a side effect. On re-upload, `imageUrl` changes but the signed URL fetch won't re-run.

Fix: replace the `useState(() => {...})` block (lines ~62-71) with a proper `useEffect` keyed on `imageUrl`. Also add `useEffect` to the import statement at the top of the file.

Note: the manual `setSignedImageUrl` call inside `handleUpload` becomes redundant after this fix (the effect will handle it when `imageUrl` updates), so I'll remove it to avoid duplicate calls.

# Fix signed image URL effect in Handwritten Import

## Problem
In `src/pages/import/HandwrittenImport.tsx`, the signed URL is fetched inside a `useState(() => {...})` initializer. This is incorrect:
- `useState` initializers run only once on mount
- The async return value is discarded (not assigned to state)
- On re-upload, `imageUrl` changes but the fetch never re-fires

## Fix
1. Add `useEffect` to the React import
2. Replace the `useState(() => {...})` block with a proper `useEffect` that depends on `imageUrl`, refetching the signed URL whenever the underlying storage path changes
3. Remove the now-redundant inline `createSignedUrl` call inside `handleUpload` (the effect will handle it automatically when `setImageUrl` runs)

## File touched
- `src/pages/import/HandwrittenImport.tsx`

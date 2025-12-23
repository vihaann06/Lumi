# Migration Notes: Vite → Next.js

## Status
✅ Structure created
🔄 Components migrated (needs testing)
⚠️ Some imports need updating

## Changes Made

### 1. Project Structure
- Created Next.js App Router structure
- Set up `/app`, `/lib`, `/server` directories
- Created boilerplate folders for future features

### 2. Dependencies
- Updated `package.json` for Next.js
- Removed `react-router-dom` (using Next.js routing)
- Kept `react-pdf`, `lucide-react`, `tailwindcss`

### 3. Routing Changes
- `react-router-dom` → Next.js App Router
- `useNavigate()` → `useRouter()` from `next/navigation`
- `useLocation()` → `useSearchParams()` from `next/navigation`
- Route state → URL search params

### 4. Component Updates
- Added `'use client'` directive to client components
- Updated import paths to use `@/lib/*` aliases
- Fixed service imports

## Testing Checklist

- [ ] Upload screen loads
- [ ] PDF upload works
- [ ] PDF viewer displays correctly
- [ ] Text selection works
- [ ] Highlighting works
- [ ] AI explanation works
- [ ] AI summary works
- [ ] Chat interface works
- [ ] Navigation between pages works

## Known Issues

1. **PDF.js Worker**: May need configuration in `next.config.js`
2. **Session Storage**: File persistence may need adjustment
3. **Import Paths**: Some components may need path updates
4. **TypeScript**: Files are `.jsx` but should be `.tsx` (can be done gradually)

## Next Steps

1. Test the migrated application
2. Fix any import/routing issues
3. Convert `.jsx` to `.tsx` gradually
4. Remove legacy `/src` directory once stable
5. Set up environment variables for API keys

## Running the App

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:3000`


# Lumi - Quick Start Guide

## Current Status

✅ **Next.js structure created** - The codebase has been restructured for Next.js with proper folder organization
✅ **PDF reading feature** - Currently functional (needs testing after migration)
🔄 **Migration in progress** - Components have been migrated but need testing

## Project Structure

The codebase is now organized for the full Lumi vision (see README.md), with boilerplate folders ready for:
- Folder-scoped AI agents
- Vector indexing (pgvector)
- Document ingestion pipeline
- Writing editor
- Citation system

## Running the Application

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

The app will be available at `http://localhost:3000`

## Current Features

- PDF upload and viewing
- Text selection and highlighting
- AI explanations (with interactive chat)
- AI summaries
- Modern, minimalistic UI

## Next Steps

1. **Test the migration** - Ensure PDF reading still works
2. **Set up database** - PostgreSQL with pgvector extension
3. **Implement folder structure** - Workspace and folder management
4. **Build ingestion pipeline** - Document processing and chunking
5. **Add vector indexing** - RAG implementation

## Important Files

- `PROJECT_STRUCTURE.md` - Detailed structure documentation
- `MIGRATION_NOTES.md` - Migration details and checklist
- `README.md` - Full product vision and architecture

## Development Notes

- Components are in `/app/components`
- Shared utilities in `/lib/utils`
- Types in `/lib/types`
- API routes in `/app/api`
- Services in `/lib/services` (client) and `/server/services` (server)

All imports use path aliases defined in `tsconfig.json` (e.g., `@/lib/*`)


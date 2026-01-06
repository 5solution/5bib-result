# 5BIB Race Results Frontend

A modern, responsive race results dashboard built with Next.js 14, TypeScript, and Tailwind CSS.

## Features

- 🔍 **Real-time Search** - Search by athlete name or BIB number
- 🏃 **Live Leaderboard** - Real-time race results display
- 🎯 **Advanced Filtering** - Filter by distance, gender, and category
- 📱 **Mobile Optimized** - Fully responsive design
- 🎨 **Athletic Design** - Bold, high-energy UI with patriotic colors
- ⚡ **Fast Performance** - Built on Next.js 14 App Router

## Design System

### Color Palette
- **Athletic Red**: `#FF0000` - Primary action color
- **Athletic Blue**: `#0000FF` - Brand and rank colors
- **White**: `#FFFFFF` - Background and text

### Typography
- **Bold, muscular** fonts for headers
- **Clean, readable** fonts for data
- **Uppercase tracking** for labels

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm
- Backend API running on port 3001

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The frontend will run on [http://localhost:3002](http://localhost:3002)

### Build for Production

```bash
# Create production build
pnpm build

# Start production server
pnpm start
```

## Project Structure

```
frontend/
├── app/
│   ├── globals.css         # Global styles and Tailwind
│   ├── layout.tsx          # Root layout
│   └── page.tsx            # Home page with race results
├── components/
│   ├── SearchBar.tsx       # Search input component
│   ├── FilterPanel.tsx     # Filter controls
│   ├── ResultsTable.tsx    # Results table display
│   └── Pagination.tsx      # Pagination component
├── lib/
│   └── api.ts              # API client and types
└── public/                 # Static assets
```

## API Integration

The frontend connects to the NestJS backend API:

**Base URL**: `http://localhost:3001`

### Endpoints Used

- `GET /api/race-results` - Fetch race results with filters
- `POST /api/race-results/sync` - Trigger manual sync

### Query Parameters

```typescript
{
  course_id?: string;      // Filter by distance
  name?: string;           // Search by name/BIB
  gender?: string;         // Filter by gender
  category?: string;       // Filter by category
  pageNo?: number;         // Page number (default: 1)
  pageSize?: number;       // Items per page (default: 20)
  sortField?: string;      // Sort field (default: OverallRank)
  sortDirection?: 'ASC' | 'DESC';  // Sort direction
}
```

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Features in Detail

### Search Functionality
- Search by athlete name (case-insensitive, partial match)
- Search by BIB number
- Real-time results update

### Filtering Options
- **Distance**: 100km, 70km, 42km, 25km, 10km, or All
- **Gender**: Male, Female, or All
- **Page Size**: 10, 20, 50, or 100 results per page

### Results Display
- **Rank Badges**: Color-coded (Gold 🥇, Silver 🥈, Bronze 🥉)
- **BIB Numbers**: Large, prominent display
- **Athlete Info**: Name, nationality, category
- **Performance Data**: Chip time, gun time, pace, gap
- **Category Ranks**: Gender rank and category rank

### Pagination
- Smart page number display
- Previous/Next navigation
- Jump to specific page
- Scroll to top on page change

## Customization

### Change Colors

Edit `tailwind.config.ts`:

```typescript
colors: {
  athletic: {
    red: '#FF0000',    // Change to your red
    blue: '#0000FF',   // Change to your blue
    white: '#FFFFFF',  // Change to your white
  },
}
```

### Change API URL

Update `.env.local`:

```env
NEXT_PUBLIC_API_URL=https://your-api-url.com
```

### Modify Page Size Options

Edit `components/FilterPanel.tsx`:

```typescript
<select>
  <option value={10}>10 results</option>
  <option value={25}>25 results</option>
  <option value={50}>50 results</option>
</select>
```

## Performance Optimizations

- ✅ Server-side rendering for SEO
- ✅ Automatic code splitting
- ✅ Image optimization
- ✅ Font optimization
- ✅ CSS minification
- ✅ React Server Components

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Troubleshooting

### API Connection Issues

**Problem**: "Failed to load race results"

**Solution**:
1. Ensure backend is running on port 3001
2. Check `.env.local` has correct API URL
3. Verify CORS is enabled in backend

### Build Errors

**Problem**: Build fails with TypeScript errors

**Solution**:
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules
pnpm install

# Rebuild
pnpm build
```

### Styling Issues

**Problem**: Tailwind classes not working

**Solution**:
1. Ensure `globals.css` is imported in `layout.tsx`
2. Check `tailwind.config.ts` content paths
3. Restart development server

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install
COPY . .
RUN pnpm build
EXPOSE 3002
CMD ["pnpm", "start"]
```

### Environment Variables in Production

Set these in your deployment platform:

```env
NEXT_PUBLIC_API_URL=https://your-production-api.com
```

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.

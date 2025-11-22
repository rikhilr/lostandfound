# Lost & Found MVP

A production-ready MVP for a "Lost & Found" web application that uses AI to match lost items with found items through image analysis and semantic search.

## 🎯 Features

- **Found Items**: Upload photos of found items. The system automatically generates:
  - Detailed description
  - Tags
  - Title
  - Proof question for verification
- **Lost Items**: Describe your lost item. The system uses embeddings to find matching found items.
- **AI-Powered Matching**: Uses OpenAI Vision API for image analysis and embeddings for semantic search.
- **Proof Verification**: Claim items by answering a proof question to verify ownership.

## 🧱 Tech Stack

- **Frontend**: Next.js 14 (App Router), React, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL with pgvector)
- **Storage**: Supabase Storage
- **AI**: OpenAI (GPT-4 Vision, Embeddings API)

## 📦 Project Structure

```
lostandfound/
├── app/
│   ├── api/
│   │   ├── found-item/
│   │   │   └── route.ts          # POST endpoint for submitting found items
│   │   ├── search-lost/
│   │   │   └── route.ts          # POST endpoint for searching lost items
│   │   └── claim-item/
│   │       └── route.ts          # POST endpoint for claiming items
│   ├── found/
│   │   └── page.tsx              # Found items upload page
│   ├── lost/
│   │   └── page.tsx              # Lost items search page
│   ├── layout.tsx                # Root layout with navigation
│   ├── page.tsx                  # Home page
│   └── globals.css               # Global styles
├── components/
│   ├── ImageUpload.tsx           # Image upload component
│   └── ResultCard.tsx            # Search result card component
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Client-side Supabase client
│   │   └── server.ts             # Server-side Supabase client (admin)
│   └── openai/
│       ├── client.ts             # OpenAI client setup
│       ├── vision.ts             # Vision API functions
│       └── embeddings.ts         # Embedding functions
├── supabase/
│   └── schema.sql                # Database schema and setup
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── next.config.js
└── README.md
```

## 🚀 Setup Instructions

### 1. Prerequisites

- Node.js 18+ installed
- npm or yarn
- Supabase account (free tier works)
- OpenAI API key

### 2. Create Next.js Project

The project structure is already set up. Install dependencies:

```bash
npm install
```

### 3. Set Up Supabase

#### 3.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and anon key from Settings > API

#### 3.2 Set Up Database

1. Go to SQL Editor in Supabase Dashboard
2. Copy and paste the contents of `supabase/schema.sql`
3. Run the SQL script to create:
   - `items_found` table
   - `item_claims` table
   - pgvector extension
   - Vector similarity search function
   - Indexes

#### 3.3 Set Up Storage

1. Go to Storage in Supabase Dashboard
2. Create a new bucket named `found-items`
3. Make it public (Settings > Public bucket: ON)
4. Set up policies:
   - **Public Access Policy**: Allow SELECT for all users
   - **Upload Policy**: Allow INSERT for authenticated users (or use service role key in API)

Alternatively, you can use the SQL commands in the schema.sql file (commented out at the bottom).

#### 3.4 Enable pgvector Extension

The schema.sql file includes `CREATE EXTENSION IF NOT EXISTS vector;` which should enable pgvector automatically. If it doesn't work:

1. Go to Database > Extensions in Supabase Dashboard
2. Search for "vector" and enable it

### 4. Configure Environment Variables

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Fill in your environment variables:
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

   # OpenAI Configuration
   OPENAI_API_KEY=sk-your_openai_api_key_here

   # App Configuration
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

   **Where to find these:**
   - Supabase URL & Keys: Supabase Dashboard > Settings > API
   - OpenAI API Key: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

### 5. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🎨 How It Works

### Found Item Flow

1. User uploads an image on `/found`
2. Image is uploaded to Supabase Storage
3. OpenAI Vision API analyzes the image and generates:
   - Title
   - Description
   - Tags
   - Proof question (extracted from unique details in the image)
4. Embeddings are generated:
   - Image embedding (from description)
   - Text embedding (from title + description + tags)
   - Combined embedding (average of both)
5. Item is saved to database with embedding vector

### Lost Item Search Flow

1. User describes their lost item on `/lost`
2. System generates embedding for the description
3. Vector similarity search finds matching items using cosine distance
4. Results are ranked by similarity score
5. User can claim an item by answering the proof question

### Proof Question Generation

The proof question is generated by OpenAI Vision API by:
1. Analyzing unique, specific details in the image
2. Extracting 1-2 distinctive features (colors, text, logos, patterns, etc.)
3. Converting one feature into a question format
4. Example: "What color is the logo on the left side of the bottle?"

### Matching Logic

**Embedding Computation:**
1. **Image Embedding**: Generated from the auto-generated description using `text-embedding-3-small`
2. **Text Embedding**: Generated from combined text (title + description + tags)
3. **Final Embedding**: Average of image and text embeddings (element-wise average)

**Vector Search:**
- Uses pgvector's cosine distance operator (`<=>`)
- SQL function `search_similar_items` performs the search
- Filters out claimed items
- Returns top-k results above similarity threshold (default: 0.7)
- Ordered by similarity (most similar first)

### Claim Verification

1. User answers the proof question
2. OpenAI GPT-3.5 verifies the answer semantically (not exact match)
3. If verified, item is marked as claimed
4. Claim record is created
5. Contact information is returned (placeholder - implement user system)

## 🚢 Deployment to Vercel

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin your-repo-url
git push -u origin main
```

### 2. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository
3. Add environment variables in Vercel Dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`
   - `NEXT_PUBLIC_APP_URL` (your Vercel URL)
4. Deploy!

### 3. Update Supabase Storage Policies

After deployment, ensure your Supabase storage bucket allows public read access and authenticated uploads.

## 📝 API Endpoints

### POST `/api/found-item`

Submit a found item.

**Request:**
- `FormData` with:
  - `image`: File (image file)
  - `location`: string (location where item was found)

**Response:**
```json
{
  "success": true,
  "item": {
    "id": "uuid",
    "image_url": "https://...",
    "auto_title": "...",
    "auto_description": "...",
    "tags": ["tag1", "tag2"],
    "proof_question": "...",
    "location": "...",
    "claimed": false,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### POST `/api/search-lost`

Search for lost items.

**Request:**
```json
{
  "description": "A black leather wallet with red stripe..."
}
```

**Response:**
```json
{
  "results": [
    {
      "id": "uuid",
      "image_url": "https://...",
      "auto_title": "...",
      "auto_description": "...",
      "location": "...",
      "created_at": "2024-01-01T00:00:00Z",
      "proof_question": "...",
      "similarity": 0.85
    }
  ]
}
```

### POST `/api/claim-item`

Claim a found item.

**Request:**
```json
{
  "itemId": "uuid",
  "proofAnswer": "red"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Item claimed successfully!",
  "contactInfo": "Contact the finder at: ..."
}
```

## 🔧 Customization

### Adjust Similarity Threshold

Edit `app/api/search-lost/route.ts`:
```typescript
match_threshold: 0.7, // Change this value (0.0 to 1.0)
```

### Change Embedding Model

Edit `lib/openai/embeddings.ts`:
```typescript
model: 'text-embedding-3-small', // or 'text-embedding-3-large', 'text-embedding-ada-002'
```

### Modify Proof Question Generation

Edit `lib/openai/vision.ts` to change the prompt for proof question generation.

## 🐛 Troubleshooting

### pgvector Extension Not Found

If you get an error about the vector extension:
1. Check Supabase Dashboard > Database > Extensions
2. Enable the "vector" extension manually
3. Re-run the schema.sql script

### Storage Upload Fails

1. Verify the bucket name is `found-items`
2. Check bucket is set to public
3. Verify storage policies allow uploads
4. Check service role key is correct

### Embedding Dimension Mismatch

If you change the embedding model, update the vector dimension in `schema.sql`:
- `text-embedding-3-small`: 1536
- `text-embedding-3-large`: 3072
- `text-embedding-ada-002`: 1536

### OpenAI API Errors

1. Verify your API key is correct
2. Check you have credits in your OpenAI account
3. Ensure you have access to GPT-4 Vision API (may require waitlist)

## 📄 License

MIT

## 🙏 Next Steps

To make this production-ready, consider:

1. **User Authentication**: Add Supabase Auth for user accounts
2. **Contact System**: Implement real contact information exchange
3. **Email Notifications**: Send emails when items are found/claimed
4. **Image Optimization**: Add image compression and resizing
5. **Rate Limiting**: Add API rate limiting
6. **Error Handling**: Enhanced error handling and logging
7. **Testing**: Add unit and integration tests
8. **Analytics**: Track usage and matches

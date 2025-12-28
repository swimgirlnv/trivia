# Vercel Deployment

This project is ready to deploy on [Vercel](https://vercel.com/).

## Steps

1. Push your code to GitHub (or your preferred Git provider).
2. Go to [vercel.com/import](https://vercel.com/import) and import your repository.
3. Set the **Root Directory** to `wits-wagers-online`.
4. Set up environment variables in the Vercel dashboard using `.env.example` as a reference.
5. Vercel will detect the build command (`npm run build`) and output directory (`dist`).
6. Deploy!

### Custom Configuration
- The root `vercel.json` is configured for monorepo support.
- If you need to customize routes or output, edit `vercel.json`.

---

For local development, see `wits-wagers-online/README.md`.

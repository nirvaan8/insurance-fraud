# ── Stage 1: install deps ───────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

# ── Stage 2: final image ────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/backend/node_modules ./backend/node_modules

# Copy source
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Create uploads dir
RUN mkdir -p backend/uploads

# Expose port
EXPOSE 3000

# Health check — generous start period for Railway cold starts
HEALTHCHECK --interval=15s --timeout=10s --start-period=40s --retries=5 \
  CMD wget -qO- http://localhost:${PORT:-3000}/health || exit 1

CMD ["node", "--max-old-space-size=400", "backend/server.js"]

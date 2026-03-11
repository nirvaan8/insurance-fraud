# ── Stage 1: deps ──────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files
COPY backend/package*.json ./backend/

# Install production deps only
RUN cd backend && npm install --omit=dev

# ── Stage 2: final image ────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Security: run as non-root user
RUN addgroup -S fraudsys && adduser -S fraudsys -G fraudsys

# Copy installed node_modules from deps stage
COPY --from=deps /app/backend/node_modules ./backend/node_modules

# Copy source files
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Create uploads directory
RUN mkdir -p backend/uploads && chown -R fraudsys:fraudsys /app

# Switch to non-root user
USER fraudsys

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Start
CMD ["node", "backend/server.js"]

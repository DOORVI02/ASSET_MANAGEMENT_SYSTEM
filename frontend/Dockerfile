# Container image for this frontend, as an alternative to Vercel (e.g. a Render Docker
# service deployed straight from the GitHub repository, no render.yaml needed — set the
# service's root directory to `frontend` so this file and the build context line up).
#
# **This is an option, not a requirement.** It was written on request, but not for the
# reason it was requested: the concern was that a host might not be able to make SMTP
# calls. Nothing in this app ever opens an SMTP connection. The browser calls Supabase over
# HTTPS, and Supabase's own Auth server connects to smtp.gmail.com. The frontend host —
# Vercel, Render, a bucket behind a CDN — is never in the mail path, so no hosting choice
# can break or fix email. Vercel remains the simpler deployment; this exists for other
# reasons (wanting a container, an existing Render account, self-hosting).
#
# The output is a static bundle behind nginx. There is no server-side runtime: this app has
# no backend of its own, only Supabase and Cloudinary.

# ── Build stage ───────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS build

WORKDIR /app

# `VITE_*` values are compile-time constants, not runtime configuration — Vite substitutes
# them into the bundle during `build`. So they must be build args; supplying them as
# container environment variables at `docker run` time would do nothing at all, and the app
# would fail at startup with `getSupabaseEnv`'s "missing environment variable" error.
#
# Render passes a service's environment variables to the Docker build as build args, so
# defining them in the dashboard is enough. With plain Docker:
#   docker build --build-arg VITE_SUPABASE_URL=... --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=... .
#
# Both values are public by design (see `src/lib/env.ts`): the publishable key is the only
# Supabase credential the browser ever holds, and every real permission boundary is RLS. The
# service-role key and the Cloudinary secret must never appear here — they belong to Edge
# Functions, and baking either into an image would publish it to anyone who pulls the image.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY

# Corepack pins pnpm to the version in package.json's lockfile ecosystem rather than
# whatever npm would install today.
RUN corepack enable

# Manifests first, so a source-only change doesn't invalidate the dependency layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Fails the build rather than shipping an image that only breaks once a user opens it. A
# missing key produces a bundle that looks fine and throws on first render.
RUN test -n "$VITE_SUPABASE_URL" || (echo "VITE_SUPABASE_URL build arg is required" && exit 1) \
 && test -n "$VITE_SUPABASE_PUBLISHABLE_KEY" || (echo "VITE_SUPABASE_PUBLISHABLE_KEY build arg is required" && exit 1)

RUN pnpm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Replaces the default site config; `nginx.conf` here carries the SPA rewrite and the same
# security headers `vercel.json` sets, so the two deployment paths are not silently
# different in their security posture.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

# nginx.conf listens on 8080 and the image runs unprivileged, so no port below 1024 is
# needed. Render ignores EXPOSE and reads $PORT, which the entrypoint below substitutes.
EXPOSE 8080

# Render (and Cloud Run, and Heroku) assign the port at runtime via $PORT rather than
# letting the image choose. `envsubst` rewrites just that one directive at startup; the
# default keeps `docker run -p 8080:8080` working with no environment set.
ENV PORT=8080
CMD ["/bin/sh", "-c", "envsubst '$PORT' < /etc/nginx/conf.d/default.conf > /etc/nginx/conf.d/default.conf.tmp && mv /etc/nginx/conf.d/default.conf.tmp /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]

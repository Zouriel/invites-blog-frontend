# syntax=docker/dockerfile:1
# Builds one Angular app (web-inviter | web-invitee) and serves it via nginx.
# Pass the app name with: --build-arg APP=web-inviter
# @zouriel/ui is a private GitHub Packages dependency. The token (read:packages scope) comes in as
# a build secret, not a build arg: a secret is mounted only while `npm ci` runs, so it never lands
# in a layer, the build cache or `docker history`. By hand:
#   NODE_AUTH_TOKEN=$(gh auth token) docker build --secret id=npm_token,env=NODE_AUTH_TOKEN --build-arg APP=web-inviter .
ARG APP=web-inviter
# production, or staging (staging.invites.blog: its own guest-site address).
ARG CONFIGURATION=production

FROM node:22-alpine AS build
ARG APP
ARG CONFIGURATION
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN --mount=type=secret,id=npm_token,env=NODE_AUTH_TOKEN,required=true npm ci
COPY . .
RUN npx ng build ${APP} --configuration ${CONFIGURATION}
# The inviter site is prerendered; list its public pages for search engines.
RUN if [ "${APP}" = "web-inviter" ]; then node scripts/write-sitemap.mjs dist/${APP}/browser; fi

FROM nginx:alpine AS runtime
ARG APP
COPY --from=build /app/dist/${APP}/browser /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

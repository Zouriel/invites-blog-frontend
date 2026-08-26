# Builds one Angular app (web-inviter | web-invitee) and serves it via nginx.
# Pass the app name with: --build-arg APP=web-inviter
# @zouriel/ui is a private GitHub Packages dependency — pass a token with
# `--build-arg NODE_AUTH_TOKEN=$(gh auth token)` (needs the write:packages/read:packages scope).
ARG APP=web-inviter

FROM node:22-alpine AS build
ARG APP
ARG NODE_AUTH_TOKEN
ENV NODE_AUTH_TOKEN=$NODE_AUTH_TOKEN
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npx ng build ${APP} --configuration production

FROM nginx:alpine AS runtime
ARG APP
COPY --from=build /app/dist/${APP}/browser /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

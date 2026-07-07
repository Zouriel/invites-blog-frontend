# Builds one Angular app (web-inviter | web-invitee) and serves it via nginx.
# Pass the app name with: --build-arg APP=web-inviter
ARG APP=web-inviter

FROM node:22-alpine AS build
ARG APP
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The shared `ui` library must be built first, then the app in production config.
RUN npx ng build ui && npx ng build ${APP} --configuration production

FROM nginx:alpine AS runtime
ARG APP
COPY --from=build /app/dist/${APP}/browser /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

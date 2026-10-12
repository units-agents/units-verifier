# units/verifier: the units worker and the "verify it yourself" tools in one image.
#
# The code under vendor/ is a snapshot of the units monorepo at the commit named in
# vendor/SOURCE.json. It is not edited here.
#
# The worker starts sandbox containers through the HOST Docker daemon (the socket is mounted in, the
# sandboxes are siblings of this container, not children). That socket is root-equivalent on the
# host: run this on a machine that does nothing else. See README, "Security".
#
# Build: ./units-verifier build      (or: docker build -t units/verifier:local .)
FROM docker:27.5.1-cli AS dockercli

FROM oven/bun:1.3.13-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*
COPY --from=dockercli /usr/local/bin/docker /usr/local/bin/docker
WORKDIR /opt/units
COPY vendor/ ./
RUN bun install --frozen-lockfile --production --ignore-scripts
COPY tools/ ./kit/
COPY entry.sh /usr/local/bin/units-entry
RUN chmod 755 /usr/local/bin/units-entry && mkdir -p /var/lib/units
ENV UNITS_HOME=/var/lib/units
LABEL org.opencontainers.image.title="units/verifier" \
      org.opencontainers.image.description="units verifier worker and verification tools; sandboxes run on the host Docker daemon" \
      units.kit="verifier"
STOPSIGNAL SIGTERM
# tini forwards SIGTERM to the worker (which finishes and reveals what it committed) and reaps the docker CLI children
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/units-entry"]
CMD ["help"]

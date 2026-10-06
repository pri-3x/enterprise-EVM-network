# The block explorer is the set of pages in the frontend:
# /blocks, /blocks/[number], /transactions, /transactions/[hash], /accounts/[address]
#
# It is served by the same Next.js app as the dashboard so there is one public
# origin, one deployment, and one place that talks to the API. A second Next.js
# application would duplicate the client without adding a trust boundary.
#
# See apps/frontend and docs/architecture.md.

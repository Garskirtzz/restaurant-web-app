// Per-domain branding for the "2 brands, shared data" setup.
//
// Both brands (Warkop Kentjana and Warkop Balap) run on the SAME server, API,
// and database. Only the customer-facing name/title differs per domain.
//
// Resolution order (see RestaurantUtils.resolveBrand):
//   1. byHost  - exact hostname match (most explicit; fill once domains are final)
//   2. matchers - first matcher whose `includes` substring is in the hostname
//   3. DEFAULT  - fallback for anything else (incl. localhost during tests)
//
// The matchers below make branding work automatically on any domain that
// contains "kentjana" or "balap" (e.g. warkop-kentjana.vercel.app or a future
// custom domain), so nothing needs to change when the real domains are added.
// If a final hostname does not contain the brand word, add it under byHost.
window.RestaurantBranding = {
    DEFAULT: { name: 'Menu Digital Restoran', title: 'Menu Digital Restoran' },
    byHost: {
        'warkop-kentjana.vercel.app': { name: 'Warkop Kentjana', title: 'Warkop Kentjana' },
        'warkop-balap.vercel.app': { name: 'Warkop Balap', title: 'Warkop Balap' }
    },
    matchers: [
        { includes: 'kentjana', brand: { name: 'Warkop Kentjana', title: 'Warkop Kentjana' } },
        { includes: 'balap', brand: { name: 'Warkop Balap', title: 'Warkop Balap' } }
    ]
};

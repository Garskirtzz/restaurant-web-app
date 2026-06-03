// Per-domain branding for the "2 brands, shared data" setup.
//
// Both brands run on the SAME server, API, and database. Only the customer-facing
// name/title differs per domain. Add one entry per production hostname under
// `byHost`. Any host not listed (including localhost during development/tests)
// falls back to DEFAULT, so behavior is unchanged until real domains are added.
//
// Example once domains exist:
//   byHost: {
//     'brand-a.example.com': { name: 'Resto A', title: 'Resto A - Menu Digital' },
//     'brand-b.example.com': { name: 'Resto B', title: 'Resto B - Menu Digital' }
//   }
window.RestaurantBranding = {
    DEFAULT: { name: 'Menu Digital Restoran', title: 'Menu Digital Restoran' },
    byHost: {}
};

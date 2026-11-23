# Shared workspace UI

Import these components from pages; do not restyle them in page-specific CSS.

- `PageHeader`: workspace title, description, actions and optional overview banner. Settings keeps its distinct photographed banner.
- `StatCard`: summary icon, label, value and note. Pass live values and `loading`; never substitute sample counts.
- `Pagination`: controlled page/page-size callbacks, bounded navigation and record counts. Filtering and data fetching remain in each page. It resets to page one when the page size changes.
- `OfficialLogos`: original transparent source logos, shared between sidebar and account screens.

`styles/tokens.css` owns shared palette and spacing values. `styles/components.css` owns these components' presentation and responsive states. Page files may arrange components with grids, but must not override their fonts, padding or button sizes. Do not reintroduce `.page-heading`, `.applicant-pagination`, `.screening-reference-pagination`, `.interview-pagination` or `.applicants-metrics`; those implementations were replaced.

API calls, search/filter state, permissions and workflow validation stay in their existing pages/services. These components have no database access.

---
description: "Reading option-list items' export values: get_option_list omits them, but GraphQL exposes RelateListItem.value — inline fragments are required on items, a GROUPED list nests the real items one level down ([{},{}] means groups, not empty items), and sortOrder is global across groups"
---

# Reading option-list export values

The gateway MCP's `get_option_list` returns only `topId`, `displayName`, `description`, and
`sortOrder` per item — **no export value**. That does not make export values unreadable
in-session: GraphQL exposes them as `RelateListItem.value`. Working query (run via the org's
`graphql_query` inner tool, through `invoke_org_tool`):

```graphql
{
  relateListOptions(id: "<listId>", itemCount: 200) {
    listOptions {
      items {
        __typename
        ... on RelateListGroup {
          topId displayName
          items {
            __typename
            ... on RelateListItem { topId displayName value sortOrder }
          }
        }
        ... on RelateListItem { topId displayName value sortOrder }
      }
    }
  }
}
```

`value` is the export value. Two behaviors to expect (both seen live, 2026-08): `value` is `null`
for an item with no export value set — that's data, not a failed read — and `itemCount` may be
ignored (full lists came back regardless), so don't rely on it for paging.

## The two traps

1. **Inline fragments are required.** `items` is typed `RemoteObjectInterface`, so plain field
   selections fail validation — select fields via `... on RelateListItem` (and
   `... on RelateListGroup`), as above.
2. **The list may be GROUPED.** `items` then returns `RelateListGroup` nodes with the real items
   nested one level down. A query without the group fragment returns empty objects — `[{},{}]`
   means "two groups the query can't see into", **not** "two items with no data".

## `sortOrder` is global across groups

`sortOrder` does **not** match within-group display order, so "render in `sortOrder`" is usually
wrong on a grouped list — follow the platform's own rendered order instead.

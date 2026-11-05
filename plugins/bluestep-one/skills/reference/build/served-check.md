# Is the published commit the one being served?

Load after every publish, before any live check.

A live check on the wrong build proves nothing, and the page gives no sign of which build it runs.

1. **Full reload** (F5) of the tab. A tab that has loaded one build of a component fails to load
   another build of it ("The remote … is already registered", "Cannot access '…' before
   initialization") until reloaded.
2. In the network panel, find `/component/<name>/<sha>/…`. Only when `<sha>` is the commit just
   published is the check made. The same answer over `/gql`:
   `remoteObjects(ids: ["<id>"]) { ... on CustomComponent { publishedSha } }`.
3. **A *Temporary login* session keeps the build it started with**, over many reloads, while
   `publishedSha` already reads the new one. Publish before the temporary login, or log in again
   after the publish.
4. Then run the UX check (`ux-check.md`), and the live check on the user's own test record (named
   with `testPrefix`), at 1440 px for a design check.

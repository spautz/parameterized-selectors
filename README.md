# parameterized-selectors

A Reselect-inspired library where selectors can use params.

### Example

```javascript
import {
  createParameterizedRootSelector,
  createParameterizedSelector,
} from 'parameterized-selectors';

// "Root" selectors have access to the raw state, and they'll be re-run whenever that state changes --
// so keep them quick and simple.
//
// In this case, we have a fully-normalized structure of authors and keys, with raw selectors to return
// lists of IDs and individual pieces of data.

const selectAuthorById = createParameterizedRootSelector(
  (state, { authorId }) => state.authorDataById[bookId],
);
const selectBookById = createParameterizedRootSelector(
  (state, { bookId }) => state.bookDataById[bookId],
);
const selectBookIdsForAuthorId = createParameterizedRootSelector(
  (state, { authorId }) => state.bookIdsByAuthorId[bookId],
);
const selectAllAuthorIds = createParameterizedRootSelector(
  state => Object.keys(state.bookIdsByAuthorId),
);

// Then those get composed into more useful selectors. In this case, the "raw" selectors only return
// arrays of IDs, while these return arrays populated with real models.

const selectAllAuthors = createParameterizedSelector(
  () => {
    // The dependency on these other selectors is tracked automatically, and this will only rerun when
    // one of them changes -- even though the arguments are dynamic.
    return selectAllAuthorIds().map(
      authorId => selectAuthorById({ authorId });
    );
  },
);

const selectAllBooksForAuthor = createParameterizedSelector(
  ({ authorId }) => {
    return selectBookIdsForAuthorId({ authorId }).map(
      bookId => selectBookById({ bookId });
    );
  },
);

// Then, in mapStateToProps -- or anywhere where state is exposed -- you'd do something like:

const author = selectAuthorById(params.authorId);
const bookList = selectAllBooksForAuthor(params.authorId);
```


### Deeper Usage

#### Sorting

```
const selectAuthorsInSortOrder = createParameterizedSelector(
  ({ sortField, reverse }) => {
    if (reverse) {
      // Recurse! A parameterized selector can make use of itself.
      // Be careful not to mutate things we didn't create ourselves, though: we should make a new array.
      const listInAscendingOrder = [ ...selectAuthorsInSortOrder({ sortField }) ];
      return [...listInAscendingOrder].reverse();
    }

    // Be careful not to mutate things we didn't create ourselves: we should make a new array.
    const unsortedList = [ ...selectAllAuthors() ];
    return unsortedList.sort(
      (a, b) => {
        // This is just a sample sort that assumes we have string values in the field
        const valueForA = a[sortField].toUpperCase();
        const valueForb = a[sortField].toUpperCase();
        if (valueForA < valueForB) return -1;
        if (valueForA > valueForB) return 1;
        return 0;
      },
    );
  },
);
```

#### Filtering

```
const selectBookSearchResults = createParameterizedSelector(
  ({ authorId, searchTerm }) => {
    let listToSearch;
    if (searchTerm.length > 2) {
      // To avoid searching the entire list each time, we can check to see whether a search for a shorter
      // term has already been done.
      let possibleEarlierSearchTerm = searchTerm.substr(0, searchTerm.length - 1);
      while (!listToSearch && possibleEarlierSearchTerm.length > 1) {
        if (selectBookSearchResults.hasCachedResult({ authorId, searchTerm: possibleEarlierSearchTerm }) {
          // We can search over the earlier results, instead of the entire list!
          listToSearch = selectBookSearchResults({ authorId, searchTerm: possibleEarlierSearchTerm });
        } else {
          possibleEarlierSearchTerm = possibleEarlierSearchTerm.substr(0, possibleEarlierSearchTerm.length - 1);
        }
      }
    }
    listToSearch = listToSearch || selectAllBooksForAuthor({ authorId });

    // This is just a sample filter 
    const uppercaseSearchTerm = searchTerm.toUpperCase();
    return listToSearch.filter(
      book => book.title.toUpperCase().startsWith(uppercaseSearchTerm),
    );
  },
);
```

# parameterized-selectors

[![Build Status](https://travis-ci.com/spautz/parameterized-selectors.svg?branch=master)](https://travis-ci.com/spautz/parameterized-selectors)
[![Coverage Status](https://coveralls.io/repos/github/spautz/parameterized-selectors/badge.svg?branch=master)](https://coveralls.io/github/spautz/parameterized-selectors?branch=master)
[![BCH compliance](https://bettercodehub.com/edge/badge/spautz/parameterized-selectors?branch=master)](https://bettercodehub.com/results/spautz/parameterized-selectors)

A Reselect-inspired library, where selectors can be passed params and their dependencies are calculated automatically.

Selector functions can be can be called inline from within each other, even conditionally or within loops, without needing to register dependencies up-front. This makes it easier to use external values like route params, or other arguments.

As with Reselect, functions are only re-run when necessary.

# Getting Started

This project is in its infancy, and does not yet have an installable package or distribution.

If you want to use it anyway, you can import it by specifying the desired commit hash in package.json, and then instruct Babel to transform node_modules/parameterized-selectors.

A distributed package is currently planned for *after* the API has stabilized and test coverage has been added.

## Features

<dl>
  <dt>Pass arguments to selector functions</dt>
  <dd>Results are memoized by the params in the first argument to each selector, so `selectItems({ categoryId: 3 })` and `selectItems({ categoryId: 4 })` will work properly and be cached independently.</dd>

  <dt>Dynamic auto-detected dependencies</dt>
  <dd>When a selector runs, any secondary selectors it calls get marked as dependencies. It won't re-run unless those dependencies return something new.</dd>

  <dt>Optimize against no-op changes</dt>
  <dd>When optimization hints are provided, a selector that returns a 'new' value which is shallowEqual or otherwise equivalent to what it returned previously can halt the re-run process (if you indicate that it should), so that further selectors don't re-run. This can greatly improve performance for selectors that return arrays, since (for example) `map` will always create a new array instance.</dd>

  <dt>Easily compatible with Reselect selectors</dt>
  <dd>A Reselect selector can be wrapped directly in a parameterized root selector, with no additional steps.</dd>
</dl>


## Annotated Example

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

// Then those get composed into more useful selectors. In this case, the "raw" selectors return arrays
// of IDs, but `selectAllAuthors` and `selectAllBooksForAuthor` return arrays populated with real models.

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

// Then, in mapStateToProps -- or wherever state is exposed -- you'd call it as a normal function:

const author = selectAuthorById(params.authorId);
const bookList = selectAllBooksForAuthor(params.authorId);
```


### Deeper Usage

#### Sorting

```javascript
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

```javascript
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

## Options

A second argument can be passed to `createParameterizedSelector` or `createParameterizedRootSelector` to provide
performance hints or behavior changes.

**These may change in the near future.** At the moment they are:

Settable at initialization only:

Name | Type | Description
--- | --- | ---
createKeyFromParams | Function(params) | Must return a string representation of the params. This will likely be replaced by a custom cache option instead (with key stringification as a canned preset). 
compareIncomingStates | Function(previousState, newState) | For root selectors only, return true to indicate that the selector should run because the incoming state is equivalent to the previous state.
compareSelectorResults | Function(previousResult, newResult) | Return true to indicate that the selector result is equivalent to its previous result, and that the previous result should be returned to callers instead.
isRootSelector | Boolean | Indicates that the selector receives and can touch `state` directly. Root selectors will run very often, so they should be small and ideally few in number.
hasStaticDepenencies | Boolean | Indicates that we can skip the work to dynamically re-record dependencies on each run.

Settable at any time:

Name | Type | Description
--- | --- | ---
displayName | String | A human-readable name for the function, used for debug output and warnings.
useConsoleGroup | Boolean | Will cause verbose logging to be nested in console groups.
verboseLoggingEnabled | Boolean | Will fill your console with far too much debug info. This will be cleaned up in the near future.
verboseLoggingCallback | Function | Gets called for every verboseLogging item; this is `console.log` by default.
performanceChecksEnabled | Boolean | Will give you warnings or pings if something causes a selector to re-run unnecessarily, or if it encounters other bad smells. (Not yet implemented.)
performanceChecksCallback | Boolean | Gets called for every failed performanceCheck item. (Not yet implemented.)
warningsEnabled | Boolean | Will notify you about library misuse and invalid/incompatible options. (Barely implemented, mostly to-do.)
warningsCallback | Function | Gets called for every warning item; this is `console.warn` by default.
exceptionCallback | Function | Gets called if your selector function throws an exception.
onInvoke | Function | Callback fired whenever the selector is executed. Useful for debugging.
onSkippedRun | Function | Callback fired when a selector returns its cached value directly. Useful for debugging.
onPhantomRun | Function | Callback fired when a selector runs but returns something equivalent to its cached value. Useful for debugging.
onFullRun | Function | Callback fired when a selector runs and returns a new value. Useful for debugging.
onAbortedRun | Function | Callback fired when a selector needs to run but isn't allowed to because it's being queried (e.g., for `hasCachedResult`.) Useful for debugging.

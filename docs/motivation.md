# Motivation for this library

This originally grew out of some lessons learned in Reselect by the frontend development team at [Teamworks](https://www.teamworks.com/), combined with past work on other projects and some client-side templating patterns.

## Friction Points

Reselect is a fantastic tool, and we use it extensively for transforming a normalized Redux state into ready-to-use models and lists of models. However, we found ourselves frequently needing to create factories to return parameter-specific selectors to use data that was outside of Redux, like route params:

```javascript 
const bookDataByIdRootSelector = state => state.bookDataById;
const bookIdsForAuthorIdRootSelector = state => state.bookIdsByAuthorId;

const bookIdsForAuthorIdSelectorFactory = memoize(
  authorId => createSelector(
    [bookIdsForAuthorIdRootSelector],
    (bookIdsForAuthorId) =>  bookIdsForAuthorId[authorId],
  ),
);
 
const booksForAuthorSelectorFactory = memoize(
  authorId => createSelector(
    [bookIdsForAuthorIdSelectorFactory(authorId), bookDataByIdRootSelector],
    (bookIdsForAuthor, bookDataById) => bookIdsForAuthor.map(bookId => bookDataById[bookId]),
  ),
);


// then, in mapStateToProps we'll get the desired IDs from route params
const authorId = params.authorId;
const booksForAuthorSelector = booksForAuthorSelectorFactory(authorId);
const booksForAuthor = booksForAuthorSelector(state);
```

This works well for straightforward cases, but we ran into some issues with more complicated cases:

* When there were _multiple_ mappings (i.e., instead of author->book there was an author->book->category situation, with multiple authors per book and a need to pull up categories for an authorId) we had to either put additional complexity into the reducer or we had to create factories for the factories.
* When sorting and filtering were added the mix, things quickly got complicated. It wasn't always feasible to dedicate a single spot in Redux for the user's search query, so we had to accommodate dynamic optimal params in addition to route params like `authorId`. We ended up creating an entire system for dynamically deriving new selectors, chain-style.
* When onboarding new developers, we found it took some time to get through the whole "selector factory" pattern: most of our selectors were doing normal functional transformations like `map` and `reduce`, but the code didn't look like that at all.

In short, things worked great for the simple cases, but more complex situations required a significant increase in complexity.

## Syntactic sugar

We found that applying some syntactic sugar to the "selector factory" pattern made things *much* easier to understand, and addressed many of the above issues:

```javascript
// Instead of exporting booksForAuthorSelectorFactory directory, we'll export this nicer-to-use sugar
const selectBooksForAuthor = (state, authorId) => booksForAuthorSelectorFactory(authorId)(state);

// Now mapStateToProps looks more direct
const booksForAuthor = selectBooksForAuthor(state, authorId);

// This pattern also makes it much easier to encapsulate chains of optional selectors, e.g. dynamic sorting is just an additional argument.
```

But the problem with this is that you still have to create the factory under the hood -- or a factory for the factory, if there are multiple levels of normalized data to hop through.

It would be cleaner if we could build everything using the `selectBooksForAuthor` style, instead of having it be syntactic sugar only, but several major issues arise from that:

1. It's not memoized, so if you do any work inside the "syntactic sugar" function you've lost many of the benefits of using Reselect selectors.
2. Trying to memoize it can lead to disaster. We used [`fastMemoize`](https://github.com/caiogondim/fast-memoize.js) in our app, which will `JSON.stringify()` the arguments that the function is called with -- but note that one of those arguments is *the entire Redux state*. That would have caused tremendous overhead and a huge memory leak, but even by-reference memoization would be defeated by the `state` argument. You'd have to do custom memoization -- at which point you're effectively reimplementing Reselect.
3. Even after all that, `state` is accessible directly. You have to rely on code reviews and other human checks to ensure nobody accesses it in ineffecient or undesirable ways.

## Making the syntactic sugar real

This library is a combination of:

* The "you'd have to do custom memoization" from #2, above. If you memoize first by params and then by the previous state then you can get the same performance as Reselect.
* Hiding state within intermediate selectors, so that they can't access it directly, while still allowing it to be passed in from `mapStateToProps`.
* Determining dependencies at runtime instead of at selector construction. This requires registering/wrapping the 'root' selectors -- otherwise we wouldn't be able to mark them as dependencies, and we wouldn't be able to provide `state` to only those -- but it then allows us to re-calculate dependencies whenever the selector is run. This was inspired by the dynamic live-binding used in EJS templates by CanJS, in the days when other Javascript MVC libraries required templates to pre-register their observables.

Plus several observations about the way we were using selectors:

#### Post-hoc equivalence checks

When data is stored fully normalized, it's common to a selector that returns an array of objects (e.g., "books for author") when the books and the authorId-to-bookId mappings live under separate Redux keys. In a normal selector any update to any book would cause the "books for author" selector to re-run -- and because that's implemented as a `map`, it'll return a new object every time it runs, which then causes any subsequent selectors for sorting/filtering/etc to also re-run. Then, by default, that will cause any React components that receive the "books for author" list as a prop to re-render -- even though, in many cases, the data may all be the same and it's merely a new array object.

This library avoids that situation by allowing a selector to cancel out its own 'new' result if it's equivalent to what it had returned previously. E.g., selectors that return an array of objects, a `shallowEqual` check is likely more useful than a referential equality check.

#### Branches, loops, and optional calls

When a list *might* be filtered, or a default sort order *may* be applied (if none is specified by the caller,) it's likely more readable to write out `if` statements than to have things always run through every possible transformation, monad-style. This isn't a universal rule, but in general it's handy to be able to route to different parts of the code dynamically -- or even recurse, when that breaks the problem down in a more readable way.

This is functionally the same problem as having to work through dereferencing multiple levels of mappings (e.g. the author->book->category situation) in that the items to be selected ultimately depend on the results of a *selector*, instead of depending on either the redux state itself or some external params. When selectors can call other selectors at-will, though, the problem becomes trivial:

```javascript
const selectCategoriesOfBooksAnAuthorWrote = createParameterizedSelector((authorId) => {
  // Getting books-by-author is easy
  const booksForAuthor = selectBooksForAuthor(authorId);

  // Getting categories-for-books-by-author would normally be a pain, likely requiring factories for factories for
  // getting param-specific selectors, but if selectors can be called dynamically then we can just loop.
  const categoriesForBooksByAuthor = booksForAuthor.reduce(
    (categoryList, book) => {
      const categoryForBook = selectCategoryForBook(book.bookId);
      if (!categoryList.includes(categoryForBook)) {
        categoryList.push(categoryForBook);
      }
      return categoryList;
    },
    [],
  );
  
  return categoriesForBooksByAuthor;
});
```

Now we have one entry point that hops over two levels of references (author->book and book->category), which will re-run if and only if the author's list of books changes or the category set for each of those books changes.

If we pass a second argument to `createParameterizedSelector` we can optimize it further, so that even if it has to re-run it won't cause further re-runs (e.g. for sorting, filtering, or re-rendering) unless we have a genuinely new list of categories:

```javascript
const selectCategoriesOfBooksAnAuthorWrote = createParameterizedSelector((authorId) => {
  // snip
}, {
  compareSelectorResults: COMPARISON_PRESETS.SHALLOW_EQUAL,
});
```

With that addition, if a new book arrives for the author but it *doesn't* alter the list of categories, the above selector will re-run but instead of returning the new array (the `reduce` will give us a new array every time it runs) it'll re-return the original array. This will let any downstream checks continue to use reference checking, so they won't re-run or re-render unnecessarily.


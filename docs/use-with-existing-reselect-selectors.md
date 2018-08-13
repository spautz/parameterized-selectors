# Using this library with existing Reselect selectors

As a general pattern, any Reselect selector can be turned into a root selector. This makes it easy to add parameterized-selectors to an existing project, so long as you can always put the parameterized selectors around the Reselect selectors (instead of the other way around).

#### Simple case: no arguments

If you have a standard Reselect selector with no args, you can wrap it directly:

```javascript
import myExistingSelector from './somewhere';

const selectSomething = createParameterizedRootSelector(myExistingSelector);
```

In that case, `state` will be passed directly to `myExistingSelector` (since it's a root selector) so it'll work just like if it was called from `mapStateToProps`.

#### Factory case with arguments

If the Reselect selector is created on-the-fly, e.g. from a factory, then you need to wrap that:

```javascript
import authorSelectorFactory from './somewhere';

const selectAuthor = createParameterizedRootSelector(
  (state, { authorId }) => {
    const authorSelector = authorSelectorFactory(authorId);
    return authorSelector(state);
  },
);

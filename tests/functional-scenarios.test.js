/* eslint-env mocha */
import chai from 'chai';

import {
  COMPARISON_PRESETS,
  createParameterizedRootSelector,
  createParameterizedSelector,
} from '../src/index';

const assert = chai.assert; // eslint-disable-line prefer-destructuring

describe('Selectors for single objects', () => {
  const initialState = {
    authorDataById: {
      1: { name: 'Alice' },
      2: { name: 'Bob' },
      3: { name: 'Chris' },
    },
    bookDataById: {
      101: { title: 'Alphabet', authorId: 1 },
      102: { title: 'Binding', authorId: 2 },
      103: { title: 'Chapter', authorId: 1 },
      104: { title: 'Dewey Decimal', authorId: 2 },
    },
    bookIdsByAuthorId: {
      1: [101, 103],
      2: [102, 104],
      3: [],
    },
  };

  let selectRawAuthorData;
  let selectRawBookData;
  let selectAuthor;
  let selectBook;
  let selectAuthorForBook;

  beforeEach(() => {
    // The selectors get recreated for each test, to reset their call counts.
    // The root selector just returns the raw data in the state, while the selector that's built on top
    // of it will add in some additional fields.
    selectRawAuthorData = createParameterizedRootSelector(
      (state, authorId) => state.authorDataById[authorId],
      {
        displayName: 'selectRawAuthorData',
        compareSelectorResults: COMPARISON_PRESETS.SHALLOW_EQUAL,
        performanceChecksEnabled: true,
      },
    );
    selectRawBookData = createParameterizedRootSelector(
      (state, bookId) => state.bookDataById[bookId],
      {
        displayName: 'selectRawBookData',
        compareSelectorResults: COMPARISON_PRESETS.SHALLOW_EQUAL,
        performanceChecksEnabled: true,
      },
    );

    // By convention in this test only, root selectors receive an ID directly while intermediate selectors
    // receive a params object.
    selectAuthor = createParameterizedSelector(
      ({ authorId }) => {
        const rawAuthorData = selectRawAuthorData(authorId);
        if (!rawAuthorData) {
          return null;
        }
        const name = (rawAuthorData.name || '').trim();
        return {
          ...rawAuthorData,
          authorId,
          name,
          nameLowerCase: name.toLowerCase(),
        };
      },
      {
        displayName: 'selectAuthor',
        compareSelectorResults: COMPARISON_PRESETS.SHALLOW_EQUAL,
        performanceChecksEnabled: true,
      },
    );
    selectBook = createParameterizedSelector(
      ({ bookId }) => {
        const rawBookData = selectRawBookData(bookId);
        if (!rawBookData) {
          return null;
        }
        const title = (rawBookData.title || '').trim();
        return {
          ...rawBookData,
          bookId,
          title,
          titleLowerCase: title.toLowerCase(),
        };
      },
      {
        displayName: 'selectBook',
        compareSelectorResults: COMPARISON_PRESETS.SHALLOW_EQUAL,
        performanceChecksEnabled: true,
      },
    );

    selectAuthorForBook = createParameterizedSelector(
      (params) => {
        const book = selectBook(params);
        if (!book || !book.authorId) {
          return null;
        }
        return selectAuthor({ authorId: book.authorId });
      },
      {
        displayName: 'selectAuthorForBook',
        performanceChecksEnabled: true,
      },
    );
  });


  it('should return author models', () => {
    const firstAuthor = selectAuthor(initialState, { authorId: 1 });
    const secondAuthor = selectAuthor(initialState, { authorId: 2 });

    assert.equal(firstAuthor.authorId, 1);
    assert.equal(firstAuthor, selectAuthor(initialState, { authorId: 1 }));
    assert.equal(secondAuthor.authorId, 2);
    assert.equal(secondAuthor, selectAuthor(initialState, { authorId: 2 }));
  });

  it('should track invoke and full-run counts properly', () => {
    selectAuthor(initialState, { authorId: 1 });
    selectAuthor(initialState, { authorId: 1 });
    selectAuthor(initialState, { authorId: 2 });
    selectAuthor(initialState, { authorId: 1 });
    selectAuthor(initialState, { authorId: 2 });
    selectAuthor(initialState, { authorId: 3 });

    assert.equal(selectAuthor.getInvokeCountForParams({ authorId: 1 }), 3);
    assert.equal(selectAuthor.getFullRunCountForParams({ authorId: 1 }), 1);
    assert.equal(selectAuthor.getPhantomRunCountForParams({ authorId: 1 }), 0);
    assert.equal(selectAuthor.getSkippedRunCountForParams({ authorId: 1 }), 2);
    assert.equal(selectAuthor.getAbortedRunCountForParams({ authorId: 1 }), 0);

    assert.equal(selectAuthor.getInvokeCountForParams({ authorId: 2 }), 2);
    assert.equal(selectAuthor.getFullRunCountForParams({ authorId: 2 }), 1);
    assert.equal(selectAuthor.getPhantomRunCountForParams({ authorId: 2 }), 0);
    assert.equal(selectAuthor.getSkippedRunCountForParams({ authorId: 2 }), 1);
    assert.equal(selectAuthor.getAbortedRunCountForParams({ authorId: 2 }), 0);

    assert.equal(selectAuthor.getInvokeCountForParams({ authorId: 3 }), 1);
    assert.equal(selectAuthor.getFullRunCountForParams({ authorId: 3 }), 1);
    assert.equal(selectAuthor.getPhantomRunCountForParams({ authorId: 3 }), 0);
    assert.equal(selectAuthor.getSkippedRunCountForParams({ authorId: 3 }), 0);
    assert.equal(selectAuthor.getAbortedRunCountForParams({ authorId: 3 }), 0);

    assert.equal(selectAuthor.getInvokeCountForParams({ authorId: 4 }), 0);
    assert.equal(selectAuthor.getFullRunCountForParams({ authorId: 4 }), 0);
    assert.equal(selectAuthor.getPhantomRunCountForParams({ authorId: 4 }), 0);
    assert.equal(selectAuthor.getSkippedRunCountForParams({ authorId: 4 }), 0);
    assert.equal(selectAuthor.getAbortedRunCountForParams({ authorId: 4 }), 0);

    assert.equal(selectAuthor.getGlobalInvokeCount(), 6);
    assert.equal(selectAuthor.getGlobalFullRunCount(), 3);
    assert.equal(selectAuthor.getGlobalPhantomRunCount(), 0);
    assert.equal(selectAuthor.getGlobalSkippedRunCount(), 3);
    assert.equal(selectAuthor.getGlobalAbortedRunCount(), 0);
  });

  it('should return book models', () => {
    const firstBook = selectBook(initialState, { bookId: 101 });
    const secondBook = selectBook(initialState, { bookId: 102 });
    const thirdBook = selectBook(initialState, { bookId: 103 });
    const fourthBook = selectBook(initialState, { bookId: 104 });

    assert.equal(firstBook.bookId, 101);
    assert.equal(firstBook, selectBook(initialState, { bookId: 101 }));
    assert.equal(secondBook.bookId, 102);
    assert.equal(secondBook, selectBook(initialState, { bookId: 102 }));
    assert.equal(thirdBook.bookId, 103);
    assert.equal(thirdBook, selectBook(initialState, { bookId: 103 }));
    assert.equal(fourthBook.bookId, 104);
    assert.equal(fourthBook, selectBook(initialState, { bookId: 104 }));
  });

  it('should not rerun the root selector when nothing has changed', () => {
    const author1 = selectAuthor(initialState, { authorId: 1 });

    assert.equal(selectAuthor.getInvokeCountForParams({ authorId: 1 }), 1);
    assert.equal(selectAuthor.getFullRunCountForParams({ authorId: 1 }), 1);
    assert.equal(selectAuthor.getSkippedRunCountForParams({ authorId: 1 }), 0);
    assert.equal(selectRawAuthorData.getInvokeCountForParams(1), 1);
    assert.equal(selectRawAuthorData.getFullRunCountForParams(1), 1);
    assert.equal(selectRawAuthorData.getSkippedRunCountForParams(1), 0);

    selectAuthor(initialState, { authorId: 1 });
    selectAuthor(initialState, { authorId: 1 });
    const author2 = selectAuthor(initialState, { authorId: 1 });

    // selectAuthor got called 3 new times, but with no change.
    // Nothing else got run.
    assert.equal(selectAuthor.getInvokeCountForParams({ authorId: 1 }), 4);
    assert.equal(selectAuthor.getFullRunCountForParams({ authorId: 1 }), 1);
    assert.equal(selectAuthor.getSkippedRunCountForParams({ authorId: 1 }), 3);
    assert.equal(selectRawAuthorData.getInvokeCountForParams(1), 1);
    assert.equal(selectRawAuthorData.getFullRunCountForParams(1), 1);
    assert.equal(selectRawAuthorData.getSkippedRunCountForParams(1), 0);

    assert.equal(author1, author2);
  });

  it('should not rerun the intermediate selector when the root selector has nothing really new', () => {
    const author1 = selectAuthor(initialState, { authorId: 1 });

    const state2 = {
      ...initialState,
      authorDataById: {
        ...initialState.authorDataById,
        1: { // make a new object, for no good reason
          ...initialState.authorDataById[1],
        },
      },
    };

    selectAuthor(state2, { authorId: 1 });
    const author2 = selectAuthor(state2, { authorId: 1 });

    assert.equal(author1, author2);

    // selectAuthor got called once, but didn't recompute, while the root selector was run but skipped.
    assert.equal(selectAuthor.getInvokeCountForParams({ authorId: 1 }), 3);
    assert.equal(selectAuthor.getFullRunCountForParams({ authorId: 1 }), 1);
    assert.equal(selectAuthor.getSkippedRunCountForParams({ authorId: 1 }), 2);
    assert.equal(selectRawAuthorData.getInvokeCountForParams(1), 2);
    assert.equal(selectRawAuthorData.getFullRunCountForParams(1), 1);
    assert.equal(selectRawAuthorData.getPhantomRunCountForParams(1), 1);
    assert.equal(selectRawAuthorData.getSkippedRunCountForParams(1), 0);
  });

  it('should return the author for a book', () => {
    const author1 = selectAuthorForBook(initialState, { bookId: 101 });
    const author2 = selectAuthorForBook(initialState, { bookId: 102 });
    const author3 = selectAuthorForBook(initialState, { bookId: 103 });
    const author4 = selectAuthorForBook(initialState, { bookId: 104 });

    assert.equal(author1.authorId, 1);
    assert.equal(author1, selectAuthorForBook(initialState, { bookId: 101 }));
    assert.equal(author2.authorId, 2);
    assert.equal(author2, selectAuthorForBook(initialState, { bookId: 102 }));
    assert.equal(author3.authorId, 1);
    assert.equal(author3, selectAuthorForBook(initialState, { bookId: 103 }));
    assert.equal(author4.authorId, 2);
    assert.equal(author4, selectAuthorForBook(initialState, { bookId: 104 }));

    assert.equal(author1, author3);
    assert.equal(author2, author4);
  });

  it('should not re-run intermediate selectors when nothing has changed', () => {
    const author1 = selectAuthorForBook(initialState, { bookId: 101 });

    assert.equal(selectAuthorForBook.getInvokeCountForParams({ bookId: 101 }), 1);
    assert.equal(selectAuthorForBook.getFullRunCountForParams({ bookId: 101 }), 1);

    assert.equal(selectBook.getInvokeCountForParams({ bookId: 101 }), 1);
    assert.equal(selectBook.getFullRunCountForParams({ bookId: 101 }), 1);
    assert.equal(selectAuthor.getInvokeCountForParams({ authorId: 1 }), 1);
    assert.equal(selectAuthor.getFullRunCountForParams({ authorId: 1 }), 1);

    assert.equal(selectRawBookData.getInvokeCountForParams(101), 1);
    assert.equal(selectRawBookData.getFullRunCountForParams(101), 1);
    assert.equal(selectRawAuthorData.getInvokeCountForParams(1), 1);
    assert.equal(selectRawAuthorData.getFullRunCountForParams(1), 1);

    selectAuthorForBook(initialState, { bookId: 101 });
    selectAuthorForBook(initialState, { bookId: 101 });
    const author2 = selectAuthorForBook(initialState, { bookId: 101 });

    // selectAuthorForBook got called 3 new times, but with no change.
    // Nothing else got run.
    assert.equal(selectAuthorForBook.getInvokeCountForParams({ bookId: 101 }), 4);
    assert.equal(selectAuthorForBook.getFullRunCountForParams({ bookId: 101 }), 1);
    assert.equal(selectAuthorForBook.getSkippedRunCountForParams({ bookId: 101 }), 3);

    assert.equal(selectBook.getInvokeCountForParams({ bookId: 101 }), 1);
    assert.equal(selectBook.getFullRunCountForParams({ bookId: 101 }), 1);
    assert.equal(selectAuthor.getInvokeCountForParams({ authorId: 1 }), 1);
    assert.equal(selectAuthor.getFullRunCountForParams({ authorId: 1 }), 1);

    assert.equal(selectRawBookData.getInvokeCountForParams(101), 1);
    assert.equal(selectRawBookData.getFullRunCountForParams(101), 1);
    assert.equal(selectRawAuthorData.getInvokeCountForParams(1), 1);
    assert.equal(selectRawAuthorData.getFullRunCountForParams(1), 1);

    assert.equal(author1, author2);
  });

  it('should not rerun the topmost selector when the intermediate and root selectors have nothing really new', () => {
    const author1 = selectAuthorForBook(initialState, { bookId: 101 });

    const state2 = {
      ...initialState,
      bookDataById: {
        ...initialState.bookDataById,
        101: { // make a new object, for no good reason
          ...initialState.bookDataById[101],
        },
      },
    };
    const author2 = selectAuthorForBook(state2, { bookId: 101 });

    assert.equal(author1, author2);

    // selectAuthorForBook got called twice, but didn't recompute, while the root selector were run twice each.
    assert.equal(selectAuthorForBook.getInvokeCountForParams({ bookId: 101 }), 2);
    assert.equal(selectAuthorForBook.getFullRunCountForParams({ bookId: 101 }), 1);
    assert.equal(selectAuthorForBook.getSkippedRunCountForParams({ bookId: 101 }), 1);

    assert.equal(selectBook.getInvokeCountForParams({ bookId: 101 }), 1);
    assert.equal(selectBook.getFullRunCountForParams({ bookId: 101 }), 1);
    assert.equal(selectAuthor.getInvokeCountForParams({ authorId: 1 }), 1);
    assert.equal(selectAuthor.getFullRunCountForParams({ authorId: 1 }), 1);

    assert.equal(selectRawBookData.getInvokeCountForParams(101), 2);
    assert.equal(selectRawBookData.getFullRunCountForParams(101), 1);
    assert.equal(selectRawBookData.getPhantomRunCountForParams(101), 1);
    assert.equal(selectRawAuthorData.getInvokeCountForParams(1), 2);
    assert.equal(selectRawAuthorData.getFullRunCountForParams(1), 1);
    assert.equal(selectRawAuthorData.getPhantomRunCountForParams(1), 1);

    const state3 = {
      ...state2,
      bookDataById: {
        ...state2.bookDataById,
        101: { // new title!
          ...state2.bookDataById[101],
          title: 'ABC',
        },
      },
    };
    const author3 = selectAuthorForBook(state3, { bookId: 101 });

    assert.equal(author1, author3);

    // The root selectors and the ones that return book data re-run, but the author ones don't
    assert.equal(selectAuthorForBook.getInvokeCountForParams({ bookId: 101 }), 3);
    assert.equal(selectAuthorForBook.getFullRunCountForParams({ bookId: 101 }), 1);
    assert.equal(selectAuthorForBook.getPhantomRunCountForParams({ bookId: 101 }), 1);
    assert.equal(selectAuthorForBook.getSkippedRunCountForParams({ bookId: 101 }), 1);

    assert.equal(selectBook.getInvokeCountForParams({ bookId: 101 }), 3);
    assert.equal(selectBook.getFullRunCountForParams({ bookId: 101 }), 2);
    assert.equal(selectBook.getSkippedRunCountForParams({ bookId: 101 }), 1);
    assert.equal(selectAuthor.getInvokeCountForParams({ authorId: 1 }), 2);
    assert.equal(selectAuthor.getFullRunCountForParams({ authorId: 1 }), 1);
    assert.equal(selectAuthor.getSkippedRunCountForParams({ authorId: 1 }), 1);

    assert.equal(selectRawBookData.getInvokeCountForParams(101), 6);
    assert.equal(selectRawBookData.getFullRunCountForParams(101), 2);
    assert.equal(selectRawBookData.getPhantomRunCountForParams(101), 1);
    assert.equal(selectRawBookData.getSkippedRunCountForParams(101), 3);
    assert.equal(selectRawAuthorData.getInvokeCountForParams(1), 3);
    assert.equal(selectRawAuthorData.getFullRunCountForParams(1), 1);
    assert.equal(selectRawAuthorData.getPhantomRunCountForParams(1), 2);
  });
});

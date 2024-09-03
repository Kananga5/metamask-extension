import {
  Span,
  startSpan,
  startSpanManual,
  withIsolationScope,
} from '@sentry/browser';
import { endTrace, trace } from './trace';

jest.mock('@sentry/browser', () => ({
  withIsolationScope: jest.fn(),
  startSpan: jest.fn(),
  startSpanManual: jest.fn(),
}));

const NAME_MOCK = 'testName';
const ID_MOCK = 'testId';
const PARENT_CONTEXT_MOCK = {} as Span;

const TAGS_MOCK = {
  tag1: 'value1',
  tag2: true,
  tag3: 123,
};

const DATA_MOCK = {
  data1: 'value1',
  data2: true,
  data3: 123,
};

function mockGetMetaMetricsEnabled(enabled: boolean) {
  global.sentry = {
    getMetaMetricsEnabled: () => Promise.resolve(enabled),
  };
}

describe('Trace', () => {
  const startSpanMock = jest.mocked(startSpan);
  const startSpanManualMock = jest.mocked(startSpanManual);
  const withIsolationScopeMock = jest.mocked(withIsolationScope);
  const setTagsMock = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();

    startSpanMock.mockImplementation((_, fn) => fn({} as Span));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    withIsolationScopeMock.mockImplementation((fn: any) =>
      fn({ setTags: setTagsMock }),
    );
  });

  describe('trace', () => {
    // @ts-expect-error This function is missing from the Mocha type definitions
    it.each([
      ['enabled', true],
      ['disabled', false],
    ])(
      'executes callback if Sentry is %s',
      async (_: string, sentryEnabled: boolean) => {
        let callbackExecuted = false;

        mockGetMetaMetricsEnabled(sentryEnabled);

        await trace({ name: NAME_MOCK }, async () => {
          callbackExecuted = true;
        });

        expect(callbackExecuted).toBe(true);
      },
    );

    // @ts-expect-error This function is missing from the Mocha type definitions
    it.each([
      ['enabled', true],
      ['disabled', false],
    ])(
      'returns value from callback if Sentry is %s',
      async (_: string, sentryEnabled: boolean) => {
        mockGetMetaMetricsEnabled(sentryEnabled);

        const result = await trace({ name: NAME_MOCK }, async () => {
          return true;
        });

        expect(result).toBe(true);
      },
    );

    it('invokes Sentry if callback provided and metrics enabled', async () => {
      mockGetMetaMetricsEnabled(true);

      await trace(
        {
          name: NAME_MOCK,
          tags: TAGS_MOCK,
          data: DATA_MOCK,
          parentContext: PARENT_CONTEXT_MOCK,
        },
        async () => Promise.resolve(),
      );

      expect(withIsolationScopeMock).toHaveBeenCalledTimes(1);

      expect(startSpanMock).toHaveBeenCalledTimes(1);
      expect(startSpanMock).toHaveBeenCalledWith(
        {
          name: NAME_MOCK,
          parentSpan: PARENT_CONTEXT_MOCK,
          attributes: DATA_MOCK,
        },
        expect.any(Function),
      );

      expect(setTagsMock).toHaveBeenCalledTimes(1);
      expect(setTagsMock).toHaveBeenCalledWith(TAGS_MOCK);
    });

    it('invokes Sentry if no callback provided and metrics enabled', async () => {
      mockGetMetaMetricsEnabled(true);

      await trace({
        id: ID_MOCK,
        name: NAME_MOCK,
        tags: TAGS_MOCK,
        data: DATA_MOCK,
        parentContext: PARENT_CONTEXT_MOCK,
      });

      expect(withIsolationScopeMock).toHaveBeenCalledTimes(1);

      expect(startSpanManualMock).toHaveBeenCalledTimes(1);
      expect(startSpanManualMock).toHaveBeenCalledWith(
        {
          name: NAME_MOCK,
          parentSpan: PARENT_CONTEXT_MOCK,
          attributes: DATA_MOCK,
        },
        expect.any(Function),
      );

      expect(setTagsMock).toHaveBeenCalledTimes(1);
      expect(setTagsMock).toHaveBeenCalledWith(TAGS_MOCK);
    });

    it('does not invoke Sentry if no callback provided and no ID', async () => {
      mockGetMetaMetricsEnabled(true);

      await trace({
        name: NAME_MOCK,
        tags: TAGS_MOCK,
        data: DATA_MOCK,
        parentContext: PARENT_CONTEXT_MOCK,
      });

      expect(withIsolationScopeMock).toHaveBeenCalledTimes(0);
      expect(startSpanManualMock).toHaveBeenCalledTimes(0);
      expect(setTagsMock).toHaveBeenCalledTimes(0);
    });
  });

  describe('endTrace', () => {
    it('ends Sentry span matching name and ID', async () => {
      const spanEndMock = jest.fn();
      const spanMock = { end: spanEndMock } as unknown as Span;

      startSpanManualMock.mockImplementationOnce((_, fn) =>
        fn(spanMock, () => {
          // Intentionally empty
        }),
      );

      await trace({
        name: NAME_MOCK,
        id: ID_MOCK,
        tags: TAGS_MOCK,
        data: DATA_MOCK,
        parentContext: PARENT_CONTEXT_MOCK,
      });

      endTrace({ name: NAME_MOCK, id: ID_MOCK });

      expect(spanEndMock).toHaveBeenCalledTimes(1);
    });

    it('does not end Sentry span if name and ID does not match', async () => {
      const spanEndMock = jest.fn();
      const spanMock = { end: spanEndMock } as unknown as Span;

      startSpanManualMock.mockImplementationOnce((_, fn) =>
        fn(spanMock, () => {
          // Intentionally empty
        }),
      );

      await trace({
        name: NAME_MOCK,
        id: ID_MOCK,
        tags: TAGS_MOCK,
        data: DATA_MOCK,
        parentContext: PARENT_CONTEXT_MOCK,
      });

      endTrace({ name: NAME_MOCK, id: 'invalidId' });

      expect(spanEndMock).toHaveBeenCalledTimes(0);
    });
  });
});

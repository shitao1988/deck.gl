import test from 'tape-catch';
import TransitionManager from '@cgcs2000/deck.gl.core/controllers/transition-manager';
import {testExports} from '@cgcs2000/deck.gl.core/controllers/map-controller';
const {MapState} = testExports;

/* global global, setTimeout, clearTimeout */
// backfill requestAnimationFrame on Node
if (typeof global !== 'undefined' && !global.requestAnimationFrame) {
  global.requestAnimationFrame = callback => setTimeout(callback, 100);
  global.cancelAnimationFrame = frameId => clearTimeout(frameId);
}

/* eslint-disable */
const TEST_CASES = [
  {
    title: 'No transition-able viewport change',
    initialProps: {
      width: 100,
      height: 100,
      longitude: -122.45,
      latitude: 37.78,
      zoom: 12,
      pitch: 0,
      bearing: 0,
      transitionDuration: 200
    },
    input: [
      // no change
      {
        width: 100,
        height: 100,
        longitude: -122.45,
        latitude: 37.78,
        zoom: 12,
        pitch: 0,
        bearing: 0,
        transitionDuration: 200
      },
      // no valid prop change
      {
        width: 200,
        height: 100,
        longitude: -122.45,
        latitude: 37.78,
        zoom: 12,
        pitch: 0,
        bearing: 0,
        transitionDuration: 200
      },
      // transitionDuration is 0
      {width: 100, height: 100, longitude: -70.9, latitude: 41, zoom: 12, pitch: 60, bearing: 0},
      // transitionInterpolator is empty
      {
        width: 100,
        height: 100,
        longitude: -70.9,
        latitude: 41,
        zoom: 12,
        pitch: 60,
        bearing: 0,
        transitionDuration: 200,
        transitionInterpolator: null
      }
    ],
    expect: [false, false, false, false]
  },
  {
    title: 'Trigger viewport transition',
    initialProps: {
      width: 100,
      height: 100,
      longitude: -70.9,
      latitude: 41,
      zoom: 12,
      pitch: 60,
      bearing: 0,
      transitionDuration: 200
    },
    input: [
      // viewport change
      {
        width: 100,
        height: 100,
        longitude: -122.45,
        latitude: 37.78,
        zoom: 12,
        pitch: 0,
        bearing: 0,
        transitionDuration: 200
      },
      // viewport change interrupting transition
      {
        width: 100,
        height: 100,
        longitude: -122.45,
        latitude: 37.78,
        zoom: 12,
        pitch: 0,
        bearing: 0,
        transitionDuration: 200
      }
    ],
    expect: [true, true]
  }
];

test('TransitionManager#constructor', t => {
  const transitionManager = new TransitionManager(MapState, {});
  t.ok(transitionManager, 'TransitionManager constructor does not throw errors');
  t.ok(transitionManager.props, 'TransitionManager has props');
  t.ok(transitionManager.transition, 'TransitionManager has transition');
  t.end();
});

test('TransitionManager#processViewStateChange', t => {
  const mergeProps = props => Object.assign({}, TransitionManager.defaultProps, props);

  TEST_CASES.forEach(testCase => {
    const transitionManager = new TransitionManager(MapState, mergeProps(testCase.initialProps));

    testCase.input.forEach((props, i) => {
      t.is(
        transitionManager.processViewStateChange(mergeProps(props)),
        testCase.expect[i],
        testCase.title
      );
    });
  });

  t.end();
});

test('TransitionManager#callbacks', t => {
  const testCase = TEST_CASES[1];

  let startCount = 0;
  let interruptCount = 0;
  let endCount = 0;
  let updateCount = 0;
  let viewport;
  let transitionProps;

  const {transitionInterpolator} = TransitionManager.defaultProps;

  const callbacks = {
    onTransitionStart: () => {
      viewport = {};
      startCount++;
    },
    onTransitionInterrupt: () => interruptCount++,
    onTransitionEnd: () => {
      t.ok(
        transitionInterpolator.arePropsEqual(viewport, transitionProps),
        'viewport matches end props'
      );
      endCount++;
    },
    onViewStateChange: ({viewState}) => {
      const newViewport = viewState;
      t.ok(!transitionInterpolator.arePropsEqual(viewport, newViewport), 'viewport has changed');
      viewport = newViewport;
      // update props in transition, should not trigger interruption
      transitionManager.processViewStateChange(Object.assign({}, transitionProps, viewport));
      updateCount++;
    }
  };

  const mergeProps = props => Object.assign({}, TransitionManager.defaultProps, callbacks, props);

  const transitionManager = new TransitionManager(MapState, mergeProps(testCase.initialProps));

  testCase.input.forEach((props, i) => {
    transitionProps = mergeProps(props);
    transitionManager.processViewStateChange(transitionProps);
  });

  transitionManager.updateTransition(200);
  transitionManager.updateTransition(400);
  transitionManager.updateTransition(600);
  transitionManager.updateTransition(800);

  t.is(startCount, 2, 'onTransitionStart() called twice');
  t.is(interruptCount, 1, 'onTransitionInterrupt() called once');
  t.is(endCount, 1, 'onTransitionEnd() called once');
  t.is(updateCount, 3, 'onViewStateChange() called');
  t.end();
});

import { requireNativeViewManager } from 'expo-modules-core';
import * as React from 'react';

import type { WaafLivestreamViewProps, WaafLivestreamViewRef } from './WaafLivestream.types';

const NativeView = requireNativeViewManager<WaafLivestreamViewProps>('WaafLivestream');

const WaafLivestreamView = React.forwardRef<WaafLivestreamViewRef, WaafLivestreamViewProps>(
  (props, ref) => <NativeView {...props} ref={ref} />,
);

WaafLivestreamView.displayName = 'WaafLivestreamView';

export default WaafLivestreamView;

'use strict';

import {PropTypes} from 'react';
import {requireNativeComponent, View} from 'react-native';

var iface = {
    name: 'ImageView',
    propTypes: {
        src: PropTypes.int,
        ...View.propTypes
    }
};

module.exports = requireNativeComponent('RCTImageView', iface);
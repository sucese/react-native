/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 * @flow
 */

import React, {Component} from 'react';
import {
    AppRegistry,
    StyleSheet,
    Text,
    View,
    ScrollView,
    RefreshControl,
    Button,
} from 'react-native';

export default class android_container extends Component {

    onClickView() {

    }

    onPressButton() {

    }

    onRefresh() {

    }

    render() {

    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5FCFF',
    },
    scrollview: {
        backgroundColor: '#F5FCFF'
    },
    button: {
        borderRadius: 10,
        padding: 10,
        shadowColor: '#000000',
        shadowOffset: {
            width: 0,
            height: 3
        },
        shadowRadius: 10,
        shadowOpacity: 0.25,
    }
});

AppRegistry.registerComponent('android_container', () => android_container);

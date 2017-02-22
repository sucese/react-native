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
    TouchableHighlight,
    View
} from 'react-native';

import ToastAndroid from './javascript/ToastAndroid';
import ImageView from './javascript/ImageView'

export default class hybrid_programming extends Component {
    render() {
        return (
            <View style={styles.container}>
                <Text style={styles.button}
                      onPress={ToastAndroid.show("ToastAndroid", ToastAndroid.SHORT)}>
                    Toast Android
                </Text>
                <ImageView src="./art/react_native_banner.png"/>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5FCFF',
    },
    button: {
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        margin: 2,
        height: 50,
        width: 200,
        alignItems: 'center',
    },
});

AppRegistry.registerComponent('hybrid_programming', () => hybrid_programming);

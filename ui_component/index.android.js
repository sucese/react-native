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
    View
} from 'react-native';

export default class ui_component extends Component {
    render() {
        return (
            <View style={styles.container}>
                <View style={styles.item}/>
                <View style={styles.item}/>
                <View style={styles.item}/>
                <View style={styles.item1}/>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'space-between',
        backgroundColor: 'white',
    },
    item: {
        height: 50,
        backgroundColor: 'grey',
    },
    item1: {
        flex:1,
        backgroundColor: 'black',
    }
});

AppRegistry.registerComponent('ui_component', () => ui_component);

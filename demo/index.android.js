/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 * @flow
 */

import React, { Component } from 'react';
import {
  AppRegistry,
  StyleSheet,
  Text,
  View
} from 'react-native';

let Dimensions = require('Dimensions');
let PixelRatio = require('PixelRatio');
let totalWidth = require('totalWidth');
let totalHeight = require('totalHeight');
let pixelRatio = require('pixelRatio');

export default class demo extends Component {
  render() {
    return (
        <View styles=(styles.container)>
        <Text style = {styles.welcome}></Text>

        </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  welcome: {
    fontSize: 20,
    textAlign: 'center',
    margin: 10,
  },
  instructions: {
    textAlign: 'center',
    color: '#333333',
    marginBottom: 5,
  },
});

//AppRegistry模块则是用来告知React Native哪一个组件被注册为整个应用的根容器。
//一般此方法只会被调用一次
AppRegistry.registerComponent('demo', () => demo);

'use strict';
import React, {Component} from 'react';
import {
    AppRegistry,
    StyleSheet,
    Text,
    View,
    TextInput
} from 'react-native';

let Dimensions = require('Dimensions');
let PixelRatio = require('PixelRatio');
let totalWidth = Dimensions.get("window").width;
let totalHeight = Dimensions.get("window").height;
let pixelRatio = PixelRatio.get();

let leftStartPoint = totalWidth * 0.1;
let componentWidth = totalWidth * 0.8;
let demo = React.createClass({

    getInitialState: function () {
        return {
            inputNum: '',
            inputPW: '',
        };
    },

    updateNum: function (newText) {
        this.setState((state) => {
            return {
                inputNum: newText
            }
        });
    },

    updateFW: function (newText) {
        this.setState(() => {
            return {
                inputFW: newText,
            };
        });
    },

    render: function () {
        return (
            <View style={styles.container}>
                <TextInput style={styles.numberInputStyle}
                           placeholder={'请输入手机号'}
                           onChangeText={(newText) => this.updateNum(newText)}/>
                <Text style={styles.textPromptStyle}>
                    您输入的手机号:{this.state.inputNum}
                </Text>
                <TextInput style={styles.passwordInputStyle}
                           placeholder={'请输入密码'}
                           password={true}
                           onChangeText={(newText) => this.updateFW(newText)}/>
                <Text style={styles.bigTextPrompt}>
                    确定
                </Text>
            </View>
        );
    },
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'white',
    },
    numberInputStyle: {
        top: 20,
        left: leftStartPoint,
        width: componentWidth,
        backgroundColor: 'grey',
        fontSize: 20
    },
    textPromptStyle: {
        top: 30,
        left: leftStartPoint,
        width: componentWidth,
        backgroundColor: 'grey',
        fontSize: 20
    },
    passwordInputStyle: {
        top: 50,
        left: leftStartPoint,
        width: componentWidth,
        backgroundColor: 'grey',
        fontSize: 20
    },
    bigTextPrompt: {
        top: 70,
        left: leftStartPoint,
        width: componentWidth,
        backgroundColor: 'blue',
        textAlign: 'center',
        fontSize: 20
    },
});

//AppRegistry模块则是用来告知React Native哪一个组件被注册为整个应用的根容器。
//一般此方法只会被调用一次
AppRegistry.registerComponent('demo', () => demo);

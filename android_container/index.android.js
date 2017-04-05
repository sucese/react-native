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

    onPressView() {

    }

    onPressButton() {

    }

    onRefresh(){

    }

    render() {
        return (
            <View style={styles.container}
            ani>
                <ScrollView
                    style={styles.scrollview}
                    refreshControl={
                        <RefreshControl
                            onRefresh={this.onRefresh()}
                            refreshing={false}
                            title='正在加载中...'
                            tintColor='#FF0000'
                            colors={['#FF0000', '#00FF00', '#0000FF']}
                            progressBackgroundColor="#FFFF00"/>
                    }>

                    <View style={styles.button}>
                        <Button
                            title='View'
                            onPress={this.onPressView}/>
                    </View>

                    <View style={styles.button}>
                        <Button
                            title='Image'
                            onPress={this.onPressButton}/>
                    </View>

                    <View style={styles.button}>
                        <Button
                            title='View'
                            onPress={this.onPressButton}/>
                    </View>

                    <View style={styles.button}>
                        <Button
                            title='View'
                            onPress={this.onPressButton}/>
                    </View>

                    <View style={styles.button}>
                        <Button
                            title='View'
                            onPress={this.onPressButton}/>
                    </View>

                    <View style={styles.button}>
                        <Button
                            title='View'
                            onPress={this.onPressButton}/>
                    </View>

                    <View style={styles.button}>
                        <Button
                            title='View'
                            onPress={this.onPressButton}/>
                    </View>

                    <View style={styles.button}>
                        <Button
                            title='View'
                            onPress={this.onPressButton}/>
                    </View>
                </ScrollView>
            </View>
        );
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

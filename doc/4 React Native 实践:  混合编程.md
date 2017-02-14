#一 Native Modules

### 1 编写 Native Module

```java
package com.guoxiaoixng.hybrid.module;

import android.widget.Toast;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.util.HashMap;
import java.util.Map;

import javax.annotation.Nullable;

/**
 * For more information, you can visit https://github.com/guoxiaoxing or contact me by
 * guoxiaoxingse@gmail.com
 *
 * @author guoxiaoxing
 * @since 17/2/14 上午10:09
 */
public class ToastModule extends ReactContextBaseJavaModule {

    private static final String DURATION_SHORT_KEY = "SHORT";
    private static final String DURATION_LONG_KEY = "LONG";

    private static final String MODULE_NAME = "ToastModule";

    public ToastModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    /**
     * ReactContextBaseJavaModule requires that a method called getName is implemented. The purpose of this method
     * is to return the string name of the NativeModule which represents this class in JavaScript. So here we will
     * call this ToastAndroid so that we can access it through React.NativeModules.ToastAndroid in JavaScript.
     */
    @Override
    public String getName() {
        return MODULE_NAME;
    }

    /**
     * An optional method called getConstants returns the constant values exposed to JavaScript. Its implementation
     * is not required but is very useful to key pre-defined values that need to be communicated from JavaScript to
     * Java in sync.
     */
    @Nullable
    @Override
    public Map<String, Object> getConstants() {
        Map<String, Object> constants = new HashMap<>();
        constants.put(DURATION_SHORT_KEY, Toast.LENGTH_SHORT);
        constants.put(DURATION_LONG_KEY, Toast.LENGTH_LONG);
        return constants;
    }

    /**
     * Override existing module
     */
    @Override
    public boolean canOverrideExistingModule() {
        return true;
    }

    /**
     * To expose a method to JavaScript a Java method must be annotated using @ReactMethod. The return type of bridge
     * methods is always void. React Native bridge is asynchronous, so the only way to pass a result to JavaScript is
     * by using callbacks or emitting events (see below).
     *
     * @param message  message
     * @param duartion duartion
     */
    @ReactMethod
    public void show(String message, int duartion) {
        Toast.makeText(getReactApplicationContext(), message, duartion).show();
    }
}
```

### 2 注册 Native Module

先编写类MainPackage实现ReactPackage接口

```java
package com.guoxiaoixng.hybrid;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.JavaScriptModule;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import com.guoxiaoixng.hybrid.module.ToastModule;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * For more information, you can visit https://github.com/guoxiaoxing or contact me by
 * guoxiaoxingse@gmail.com
 *
 * @author guoxiaoxing
 * @since 17/2/14 上午10:15
 */
public class MainPackage implements ReactPackage {

    /**
     * Register the Module; this happens in the createNativeModules of your apps package. If a module is not
     * registered it will not be available from JavaScript.
     *
     * @param reactContext reactContext
     */
    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new ToastModule(reactContext));
        return modules;
    }

    @Override
    public List<Class<? extends JavaScriptModule>> createJSModules() {
        return Collections.emptyList();
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}
```

再将MainPackage添加到MainApplication里的getPackages()方法里

```java
package com.guoxiaoixng.hybrid;

import android.app.Application;

import com.facebook.react.ReactApplication;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.shell.MainReactPackage;
import com.facebook.soloader.SoLoader;

import java.util.Arrays;
import java.util.List;

public class MainApplication extends Application implements ReactApplication {

    private final ReactNativeHost mReactNativeHost = new ReactNativeHost(this) {
        @Override
        public boolean getUseDeveloperSupport() {
            return BuildConfig.DEBUG;
        }

        @Override
        protected List<ReactPackage> getPackages() {
            return Arrays.<ReactPackage>asList(
                    new MainReactPackage(),
                    new MainPackage()
            );
        }
    };

    @Override
    public ReactNativeHost getReactNativeHost() {
        return mReactNativeHost;
    }



    @Override
    public void onCreate() {
        super.onCreate();
        SoLoader.init(this, /* native exopackage */ false);
    }
}

```

### 3 在JavaScript中调用

编写ToastAndroid.js

```javascript
'use strict';
import { NativeModules } from 'react-native';
module.exports = NativeModules.ToastAndroid;
```

调用编写ToastAndroid.js

```javascript
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

export default class hybrid_programming extends Component {
    render() {
        return (
            <View style={styles.container}>
                <Text style={styles.button}
                      onPress={ToastAndroid.show("ToastAndroid", ToastAndroid.SHORT)}>
                    Toast Android
                </Text>
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

```
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
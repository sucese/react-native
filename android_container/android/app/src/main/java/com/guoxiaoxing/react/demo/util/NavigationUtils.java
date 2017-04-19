package com.guoxiaoxing.react.demo.util;

import android.content.Context;
import android.text.TextUtils;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

/**
 * For more information, you can visit https://github.com/guoxiaoxing or contact me by
 * guoxiaoxingse@163.com.
 *
 * @author guoxiaoxing
 * @since 2017/4/19 上午11:24
 */
public class NavigationUtils extends ReactContextBaseJavaModule {

    private static final String MODULE_NAME = "NavigationUtils";

    private static final String NAVIGATION_JAVA_CALL_JS = "NAVIGATION_JAVA_CALL_JS";

    public NavigationUtils(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void startActivity(Context context, String protocal) {
        if (TextUtils.isEmpty(protocal)) {
            return;
        }
        switch (protocal) {
            case NAVIGATION_JAVA_CALL_JS:
                break;
        }
    }
}

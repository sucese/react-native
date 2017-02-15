package com.guoxiaoixng.hybrid.module;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

/**
 * For more information, you can visit https://github.com/guoxiaoxing or contact me by
 * guoxiaoxingse@gmail.com
 *
 * @author guoxiaoxing
 * @since 17/2/14 下午2:36
 */
public class MessageModule extends ReactContextBaseJavaModule {

    private static final String MODULE_NAME = "MessageModule";

    ReactApplicationContext sContext;

    public MessageModule(ReactApplicationContext reactContext) {
        super(reactContext);
        sContext = reactContext;
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void handMessage(String message) {

    }

    @Override
    public boolean canOverrideExistingModule() {
        return super.canOverrideExistingModule();
    }
}
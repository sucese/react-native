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
package com.guoxiaoxing.react.demo.communication;

import com.facebook.react.bridge.JavaScriptModule;

/**
 * For more information, you can visit https://github.com/guoxiaoxing or contact me by
 * guoxiaoxingse@163.com.
 *
 * @author guoxiaoxing
 * @since 2017/4/19 下午2:07
 */
public interface AlertJavaScriptModule extends JavaScriptModule {
    void showAlert(String message);
}

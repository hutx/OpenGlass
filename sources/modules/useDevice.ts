import * as React from 'react';
import { BleManager, Device } from 'react-native-ble-plx'
import { PermissionsAndroid, Platform, NativeModules, NativeEventEmitter } from 'react-native';

const bleManager = new BleManager();

// 请求 Android 权限
const requestAndroidPermissions = async () => {
    if (Platform.OS === 'android' && Platform.Version >= 23) {
        const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
                title: '需要位置权限',
                message: '扫描蓝牙设备需要位置权限',
                buttonNeutral: '稍后询问',
                buttonNegative: '取消',
                buttonPositive: '确定'
            }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
    } else if (Platform.OS === 'ios') {

    }
    return true;
};

export function useDevice(): [Device | null, () => Promise<void>] {

    // Create state
    let deviceRef = React.useRef<Device | null>(null);
    let [device, setDevice] = React.useState<Device | null>(null);

    // Create callback
    const doConnect = React.useCallback(async () => {
        try {
            // 检查权限
            const hasPermission = await requestAndroidPermissions();
            if (!hasPermission) {
                throw new Error('未获得蓝牙权限');
            }
            
            try {
                // 确保之前的扫描已停止
                bleManager.stopDeviceScan();
                
                // 扫描设备
                console.log('开始扫描蓝牙设备...');
                await bleManager.startDeviceScan(
                    ['19B10000-E8F2-537E-4F6C-D104768A1214'.toLowerCase()], 
                    { allowDuplicates: false },
                    (error, device) => {
                        if (error) {
                            console.error('扫描设备时出错:', error);
                            return;
                        }
                        
                        if (device?.name === 'OpenGlass') {
                            console.log('找到OpenGlass设备:', device.id, device.name);
                            bleManager.stopDeviceScan();
                            
                            // 连接设备
                            device.connect()
                                .then(connectedDevice => {
                                    console.log('已连接到设备');
                                    return connectedDevice.discoverAllServicesAndCharacteristics();
                                })
                                .then(discoveredDevice => {
                                    console.log('已发现所有服务和特征');
                                    deviceRef.current = discoveredDevice;
                                    setDevice(discoveredDevice);
                                })
                                .catch(error => {
                                    console.error('初始化BLE时出错:', error);
                                });
                        }
                    }
                );
            } catch (e) {
                console.error('初始化BLE时出错:', e);
            }
        } catch (e) {
            console.error(e);
        }
    }, []);

    // Return
    return [device, doConnect];
}
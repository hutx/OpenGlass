import * as React from 'react';
import {BleManager} from 'react-native-ble-plx'
import { PermissionsAndroid, Platform } from 'react-native';

if (Platform.OS !== 'web') {
// 创建 BLE 管理器实例
    // const bleManager = new BleManager();
}

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
    }else if (Platform.OS === 'ios'){

    }
    return true;
};

export function useDevice(): [BluetoothRemoteGATTServer | null, () => Promise<void>] {

    // Create state
    let deviceRef = React.useRef<BluetoothRemoteGATTServer | null>(null);
    let [device, setDevice] = React.useState<BluetoothRemoteGATTServer | null>(null);

    // Create callback
    const doConnect = React.useCallback(async () => {
        try {
            if (Platform.OS === 'web') {
                // Web 平台使用 Web Bluetooth API
                let connected = await navigator.bluetooth.requestDevice({
                    filters: [{ name: 'OpenGlass' }],
                    optionalServices: ['19B10000-E8F2-537E-4F6C-D104768A1214'.toLowerCase()],
                });
                let gatt: BluetoothRemoteGATTServer = await connected.gatt!.connect();
                deviceRef.current = gatt;
                setDevice(gatt);
            } else {
                // iOS 和 Android 平台
                // 检查权限
                const hasPermission = await requestAndroidPermissions();
                if (!hasPermission) {
                    throw new Error('未获得蓝牙权限');
                }
                const bleManager = new BleManager();
                // 扫描设备
                bleManager.startDeviceScan(null, null, (error, device) => {
                    if (error) {
                        console.error(error);
                        return;
                    }

                    if (device?.name === 'OpenGlass') {
                        bleManager.stopDeviceScan();
                        device.connect()
                            .then(device => device.discoverAllServicesAndCharacteristics())
                            .then(device => {
                                deviceRef.current = device as any;
                                setDevice(device as any);
                            })
                            .catch(error => {
                                console.error(error);
                            });
                    }
                });
            }
        } catch (e) {
            console.error(e);
        }
    }, [device]);

    // Return
    return [device, doConnect];
}
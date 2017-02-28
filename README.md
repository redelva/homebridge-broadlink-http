# homebridge-broadlink-http

It has to work with a Android app named Broadlink RM Bridge(https://play.google.com/store/apps/details?id=us.originally.tasker)

It will offer a function named Http Bridge. Simplely an api server for broadlink device.

You can open http://yourandroiddeviceip:port to get http url（try url/devices and url/codes）.

Next, edit your config.json and work with Homebridge(I am using a Raspberry pi to run homebridge).

a sample config.json for you.

{
    "bridge": {
        "name": "中城苑",
        "username": "CD:22:3D:E3:CE:30",
        "port": 51826,
        "pin": "123-45-678"
    },
    "description": "This is my home",
    "platforms": [
       
    ],
    "accessories": [
        {
            "accessory": "BroadlinkHttp",
            "name": "客厅机顶盒",
            "switchHandling": "no",
            "http_method": "GET",
            "on_url": "http://192.168.31.63:9876/send?deviceMac=b4430d38a836&codeId=241",
            "off_url": "http://192.168.31.63:9876/send?deviceMac=b4430d38a836&codeId=241",
            "service": "Switch"
        }
    ]
}

Make sure your android device is always online.

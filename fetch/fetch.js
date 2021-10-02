const apiUrl = 'https://api.nhk.jp/r6/l/tvepisode/ts/X8R36PYLX3.json'
const perSize = 10
let offset = 0
let parseData = []
let totalApiEpisode = 0
let totalApiImgs = 0
let debugImgs = 0

/**
 * 从API接口获取数据
 * @param depth
 */
function getData(depth) {
    depth = depth ? depth : 0
    if (depth === 0) {
        offset = 0
        totalApiEpisode = 0
        totalApiImgs = 0
    }

    $.ajax({
        url: apiUrl,
        type: 'get',
        dataType: 'json',
        data: {
            offset: offset,
            size: perSize,
            status: 'broadcasted',
            orderBy: 'releasedEvent',
            order: 'desc'
        },
        success: function(res) {
            console.log(res, offset)
            if (res.result.length === 0) {
                return;
            }

            dataHandler(res.result)
            offset += perSize
            getData(++depth)
        },
        error: function(xhr) {
            if (xhr.status === 404) {
                localDataHandler()
                parseData.sort(function(a, b) {
                    var aDate = (new Date(a.releasedEvent.startDateFmt)).getTime();
                    var bDate = (new Date(b.releasedEvent.startDateFmt)).getTime();
                    return aDate - bDate;
                });
                console.log(parseData)
                console.log(totalApiImgs, totalApiEpisode,debugImgs)
            }
        }
    })
}

/**
 * 处理API接口数据
 * @param resData
 */
function dataHandler(resData) {
    resData.forEach(function (resDatum) {
        totalApiEpisode++

        let parseDatum = [];
        let eyecatches = resDatum.eyecatch ? [resDatum.eyecatch] : []
        eyecatches = eyecatches.concat(resDatum.eyecatches ? resDatum.eyecatches : [])
        parseDatum.name = convertName(resDatum.name)
        parseDatum.description = resDatum.description
        parseDatum.releasedEvent = resDatum.releasedEvent
        parseDatum.releasedEvent.startDateFmt = new Date(resDatum.releasedEvent.startDate).format('yyyy/MM/dd')
        parseDatum.url = ""
        parseDatum.urls = []
        parseDatum.other = ""
        parseDatum.imgs = []
        // 编辑版本
        parseDatum.version = 2;
        // 新数据默认需要更新图片
        let updateImgs = true;

        if (parseDatum.imgs.length > 1) {
            totalApiImgs++
        }

        for (let i=0; i<data.length; i++) {
            let datum = data[i]
            if (matchName(resDatum.name, datum.name)) {
                parseDatum.url = datum.url
                parseDatum.urls = datum.urls
                parseDatum.other = datum.other
                parseDatum.imgs = datum.imgs
                parseDatum.version = datum.version ? datum.version : 1;
                // 如果js里面的数据已经是版本2的数据（来源于官方API）则不更新图片了，否则更新图片。
                updateImgs = parseDatum.version === 1
            }
        }

        // 图片处理（
        let eyecatchesLen = eyecatches.length
        if (updateImgs && eyecatchesLen > 1) {
            let zipFileNum = 0;

            let zip = new JSZip()
            downloadFile(zip, eyecatches, parseDatum, 0)

            for (let i in eyecatches) {
                let url = eyecatches[i].main.url
                let filename = url.replace(/^.*\//g, '');
                parseDatum.imgs.push('./resource/imgs/' + filename)
            }

            totalApiImgs++
        }

        parseData.push(parseDatum)
    })
}

function downloadFile(zip, eyecatches, parseDatum, index) {
    if (index >= eyecatches.length) {
        return
    }

    let url = eyecatches[index].main.url
    let filename = url.replace(/^.*\//g, '');

    jQuery.ajax({
        url: url,
        cache: false,
        xhr: function () {
            var xhr = new XMLHttpRequest()
            xhr.responseType = 'arraybuffer'
            return xhr
        },
        success: function(data){
            zip.file(filename, data)

            if(index < eyecatches.length - 1) {
                downloadFile(zip, eyecatches, parseDatum, ++index)
                return
            }

            zip.generateAsync({type:"blob"}, function updateCallback(metadata) {
                var msg = "progression : " + metadata.percent.toFixed(2) + " %";
                if(metadata.currentFile) {
                    msg += ", current file = " + metadata.currentFile;
                }
                // console.log(msg);
            })
                .then(function callback(blob) {
                    debugImgs++
                    console.log(debugImgs)

                    // see FileSaver.js
                    saveAs(blob, parseDatum.name + ".zip");
                }, function (e) {
                    console.log(e);
                });
        },
        error:function(xhr, err){
            console.log(xhr, err)
        }
    });
}

/**
 * 本地数据 未匹配上API的数据的处理
 */
function localDataHandler() {
    data.forEach(function (datum) {
        for (let i in parseData) {
            let parseDatum = parseData[i]
            if (matchName(parseDatum.name, datum.name)) {
                return;
            }
        }

        let parseDatum = {
            name: convertName(datum.name),
            description: datum.detail,
            url: datum.url,
            urls: datum.urls,
            other: datum.other,
            imgs: datum.imgs,
            releasedEvent: {
                startDate: datum.date,
                startDateFmt: new Date(datum.date).format('yyyy/MM/dd')
            }
        };
        parseData.push(parseDatum)
    })
}

// 片名转换
function matchName(apiName, localName) {
    apiName = convertName(apiName)
    localName = convertName(localName)
    return apiName === localName;
}

/**
 * 片名转换
 * @param name
 * @returns {*}
 */
function convertName(name) {
    let preg = /^選/
    name = name.replace(preg, '')
    name = CtoH(name)
    return name;
}

/**
 * 全角转半角
 * @param str
 * @returns {string}
 * @constructor
 */
function CtoH(str){
    var result="";
    for (var i = 0; i < str.length; i++){
        if (str.charCodeAt(i)===12288){
            result+= String.fromCharCode(str.charCodeAt(i)-12256);
            continue;
        }
        if (str.charCodeAt(i)>65280 && str.charCodeAt(i)<65375) result+= String.fromCharCode(str.charCodeAt(i)-65248);
        else result+= String.fromCharCode(str.charCodeAt(i));
    }
    return result;
}

/**
 *对Date的扩展，将 Date 转化为指定格式的String
 *月(M)、日(d)、小时(h)、分(m)、秒(s)、季度(q) 可以用 1-2 个占位符，
 *年(y)可以用 1-4 个占位符，毫秒(S)只能用 1 个占位符(是 1-3 位的数字)
 *例子：
 *(new Date()).Format("yyyy-MM-dd hh:mm:ss.S") ==> 2006-07-02 08:09:04.423
 *(new Date()).Format("yyyy-M-d h:m:s.S")      ==> 2006-7-2 8:9:4.18
 */
Date.prototype.format = function (fmt) {
    var o = {
        "M+": this.getMonth() + 1, //月份
        "d+": this.getDate(), //日
        "h+": this.getHours(), //小时
        "m+": this.getMinutes(), //分
        "s+": this.getSeconds(), //秒
        "q+": Math.floor((this.getMonth() + 3) / 3), //季度
        "S": this.getMilliseconds() //毫秒
    };
    if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
    return fmt;
}
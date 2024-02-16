const fs = require('fs');
const path = require('path');
const exec = require('child_process').execFile;
const spawn = require('child_process').spawn;
const ARCHIVES = process.argv.slice(3);
const EXTRACT_PATH = `${__dirname}/output`;
const CONFIG_PATH = `${__dirname}/config.txt`;
let newID = process.argv[2];
let folderCounter = 0;

function updateFileFolderID(dir, str) {
    var files = fs.readdirSync(dir);
    for (let i = 0; i < files.length; ++i) {
        let fileName = files[i];
        let path = `${dir}/${fileName}`;
        let file = fs.statSync(path);
        let newPath = path;
        let isDir = file.isDirectory();
        if (folderCounter > 4 && !fileName.endsWith('.xml'))
            newPath = isDir ? `${dir}/${str}` : `${dir}/${str}.${fileName.split('.').pop()}`;
        fs.renameSync(path, newPath);
        if (isDir) {
            folderCounter++;
            updateFileFolderID(newPath, str);
        }
    }
}

function readdirRecur(dir, arrayOfFiles) {
	try {
		arrayOfFiles = arrayOfFiles || [];
		let files = fs.readdirSync(dir);
		files.forEach(file => {
			try {
				if (fs.statSync(dir + '/' + file).isDirectory()) {
					arrayOfFiles = readdirRecur(dir + '/' + file, arrayOfFiles);
				} else {
					arrayOfFiles.push(path.join(dir, '/', file));
				}
			} catch { }
		});
	} catch { }
	return arrayOfFiles;
}

function getYabberFilePath(rootPath) {
	return readdirRecur(rootPath).filter(x => x.endsWith('Yabber.exe'))[0];
}

function rmdirRecur(path) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(file => {
            let filePath = `${path}/${file}`;
            if (fs.lstatSync(filePath).isDirectory()) {
                rmdirRecur(filePath);
            } else {
                fs.unlinkSync(filePath);
            }
        });
        fs.rmdirSync(path);
    }
}

rmdirRecur(EXTRACT_PATH);
if (!fs.existsSync(CONFIG_PATH)) fs.writeFileSync(CONFIG_PATH, '');
const CONFIG_FILE = fs.readFileSync(CONFIG_PATH, 'utf-8');
let yabberPath = CONFIG_FILE;
if (!CONFIG_FILE.endsWith('Yabber.exe')) {
	yabberPath = getYabberFilePath('D:/');
	if (!yabberPath) {
		console.log('Yabber could not be found. Please manually specify the path in the config.');
		return;
	}
	fs.writeFileSync(CONFIG_PATH, yabberPath);
}
if (!fs.existsSync(EXTRACT_PATH)) fs.mkdirSync(EXTRACT_PATH);

let decrementId = false;
for (let i = 0; i < ARCHIVES.length; ++i) {
    let dcxName = ARCHIVES[i].replace(/^.*[\\\/]/, '').replace('-partsbnd-dcx', '');
    let idArr = dcxName.match(/[0-9]/g);
    if (!idArr) break;
    let id = parseInt(idArr.join(''));
	let newId = id;
	if (newId >= 4003) decrementId = true;
	else if (newId < 4003) decrementId = false;
	if (decrementId) newId--;
    let dcxPrefix = dcxName.match(/[^0-9]*/)[0];
    let path = `${ARCHIVES[i]}`;
    let isUnpacked = !path.endsWith('.dcx');
    let fixedPath = path.replace('.partsbnd.dcx', '-partsbnd-dcx');
    let extractedPath = `${EXTRACT_PATH}/${fixedPath.replace(/^.*[\\\/]/, '')}`;
    exec(yabberPath, [isUnpacked ? '' : path], (data) => {
        fs.renameSync(`${fixedPath}`, extractedPath);
        let xmlPath = `${extractedPath}/_yabber-bnd4.xml`
        let xml = fs.readFileSync(xmlPath, 'utf-8');
        xml = xml.replace(new RegExp(id.toString().padStart(4, '0'), 'g'), newId).replace('DarkSouls3', 'SekiroKRAK');
        let rootRegex = new RegExp(/(?<=N:\\)[^<]*/g);
        let pathRegex = new RegExp(/(?<=<path>)[^<]*/g);
        let roots = xml.match(rootRegex);
        let paths = xml.match(pathRegex);
        xml = xml.replaceAll(rootRegex, '');
        for (let i = 0; i < paths.length; ++i)
            xml = xml.replace(paths[i], roots[i].replace('FDP', 'GR') + paths[i]);
        let fixedDcxName2 = dcxName.replace(id.toString().padStart(4, '0'), newId).replace('.partsbnd.dcx', '').toUpperCase();
        let typeNameRegex = new RegExp(/(?<=parts\\)[^\\]*/);
        let typeName = xml.match(typeNameRegex)[0];
        xml = xml.replaceAll(new RegExp('(?<=' + typeName + '\\\\)[^\\\\]*', 'g'), fixedDcxName2);
        xml = xml.replaceAll(new RegExp('(?<=' + fixedDcxName2 + '\\\\)[^.]*', 'g'), fixedDcxName2);
        fs.writeFileSync(xmlPath, xml);
        let fixedExtractedPath = extractedPath.replace(id.toString().padStart(4, '0'), id);
        fs.renameSync(extractedPath, fixedExtractedPath);
        extractedPath = fixedExtractedPath;
        let fixedFolderStructure = `${extractedPath}/GR/data/INTERROOT_win64`;
        let needsFixing = !fs.existsSync(fixedFolderStructure);
        fs.mkdirSync(fixedFolderStructure, {
            recursive: true
        });
        if (needsFixing) fs.renameSync(`${extractedPath}/parts/`, `${fixedFolderStructure}/parts/`);
        updateFileFolderID(extractedPath, fixedDcxName2);
        folderCounter = 0;
        exec(yabberPath, [extractedPath], (data) => {});
    });
}
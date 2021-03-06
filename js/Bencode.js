//
// Bencode.js
// Decode and Encode data in Bittorrent format                          |
//
// Copyright (c) 2010, 2012 by Ildar Shaimordanov
//


/*

Here is brief description of Bencoding. 
See the following links to learn more details:

http://en.wikipedia.org/wiki/Bencode
http://wiki.theory.org/BitTorrentSpecification#Bencoding


Bencoded string supports strings, integers, lists and dictionaries 
using specific encoding rules. In JavaScript a list is an Array, and 
a dictionary is an Object. 

Strings
Bencoded strings are encoded as follows: 
<string length encoded in base ten ASCII>:<string data>, or key:value
Ex.: 6:string represents the string "string"

Integers
Bencoded integers are encoded as follows: 
i<integer encoded in base ten ASCII>e
Ex.: i3e represents the integer "3"

Lists
Bencoded lists are encoded as follows:
l<bencoded values>e
Ex.: l6:stringi3ee represents the list of two values ["string", 3]

Dictionaries
Bencoded dictionaries are encoded as follows:
d<bencoded string><bencoded element>e 
Ex.: d3:str6:string3:inti3ee represents { "str": "string", "int": 3 }


Bencode.stringify(value)
Takes an object and converts it to a bencoded string. 

Bencode.parse(value)
Takes a string and converts it to an object. 

Bencode.PATH_DELIMITER = '\\';
A path delimier equals '\\'. It is used to concatenate parts of paths. 
It can be changed before calling Bencode.torrentInfo(). 

Bencode.torrentInfo(value, key)
Considers an input object as a torrent and returns parts specified by the key 
value. If the input value is a string it will be previously converted to the 
object. There are several special keys to gather definite values:

'name'
the name of the torrent (string)

'piece length'
number of bytes in each piece (integer)

'pieces'
string consisting of the concatenation of all 20-byte SHA1 hash values, 
one per piece (byte string, i.e. not urlencoded). This is untrusted field 
due to differences of used encodings in JScript

'creation date'
the creation time of the torrent converted to the 
standard presentaion of Date in JavaScript

'announce-list'
always a list of announces (instead of a list of lists of strings)

'file-names'
always a list of filenames in the torrent

'file-sizes'
always a list of file sizes in the torrent


Example using a part of the external code (see the comment below):
// http://demon.tw/my-work/javascript-bencode.html
function read(path) {
    var cp1252Chars = [/\u20AC/g,/\u201A/g,/\u0192/g,/\u201E/g,/\u2026/g,/\u2020/g,/\u2021/g,/\u02C6/g,/\u2030/g,/\u0160/g,/\u2039/g,/\u0152/g,/\u017D/g,/\u2018/g,/\u2019/g,/\u201C/g,/\u201D/g,/\u2022/g,/\u2013/g,/\u2014/g,/\u02DC/g,/\u2122/g,/\u0161/g,/\u203A/g,/\u0153/g,/\u017E/g,/\u0178/g];
    var latin1Chars = ["\u0080","\u0082","\u0083","\u0084","\u0085","\u0086","\u0087","\u0088","\u0089","\u008A","\u008B","\u008C","\u008E","\u0091","\u0092","\u0093","\u0094","\u0095","\u0096","\u0097","\u0098","\u0099","\u009A","\u009B","\u009C","\u009E","\u009F"];
    var binstream = new ActiveXObject("ADODB.Stream");
    binstream.Type = 2;
    binstream.Charset = "iso-8859-1";
    binstream.Open();
    binstream.LoadFromFile(path);
    var s = binstream.ReadText();
    for (var i = 0; i < 27; i++)
        s = s.replace(cp1252Chars[i], latin1Chars[i]);
    return s;
}
 
var filename = 'foo.torrent';
 
var text = read(filename);
var torrent = Bencode.parse(text);
 
WScript.Echo( Bencode.torrentInfo(torrent, 'name') );
WScript.Echo( Bencode.torrentInfo(torrent, 'creation date') );
WScript.Echo( Bencode.torrentInfo(torrent, 'file-names') );


*/

var Bencode = Bencode || {};

(function()
{

var toString = Object.prototype.toString;

var stringify = function(value)
{
	var typeOf = toString.call(value);

	if ( typeOf == '[object Number]' ) {
		return 'i' + parseInt(value) + 'e';
	}
	if ( typeOf == '[object String]' ) {
		return value.length + ':' + value.toString();
	}
	if ( typeOf == '[object Date]' ) {
		return 'i' + Math.floor(value.getTime() / 1000) + 'e';
	}

	var result = [];

	if ( typeOf == '[object Array]' ) {
		for (var i = 0; i < value.length; i++) {
			result.push(stringify(value[i]));
		}
		return 'l' + result.join('') + 'e';
	}

	for (var p in value) {
		if ( ! value.hasOwnProperty(p) ) {
			continue;
		}
		result.push(stringify(String(p)) + stringify(value[p]));
	}
	return 'd' + result.join('') + 'e';
};


var i = 0;
var text;

var parser = function()
{
	var c = text.charAt(i);

	var err;

	switch (c) {
	case 'i':
		err = 'integer';

		var matches = text.slice(i).match(/^i(-?\d+)e/);
		if ( ! matches ) {
			break;
		}

		i += matches.lastIndex;
		return Number(matches[1]);

	case 'l':
		err = 'list';

		i++;

		var result = [];
		while ( i < text.length && text.charAt(i) != 'e' ) {
			result.push(parser());
		}

		if ( text.charAt(i) != 'e' ) {
			break;
		}

		i++;
		return result;

	case 'd':
		err = 'dictionary';

		i++;

		var result = {};
		while ( i < text.length && text.charAt(i) != 'e' ) {
			var k = parser();
			var v = parser();
			result[k] = v;
		}

		if ( text.charAt(i) != 'e' ) {
			break;
		}

		i++;
		return result;

	default:
		err = 'string';

		var matches = text.slice(i).match(/^(\d+):/);
		if ( ! matches ) {
			break;
		}

		var len = Number(matches[1]);
		var a = i + matches.lastIndex;
		var b = a + len;

		var result = text.slice(a, b);
		if ( result.length != len ) {
			break;
		}

		i = b;
		return result;
	}

	// Here is abnormal ending
	throw new RangeError('Bencode.parse: Illegal ' + err + ' at ' + i + ' (0x' + i.toString(16).toUpperCase() + ')');
};


var torrentInfo = function(value, key)
{
	switch ( key ) {
	case 'name': 
	case 'piece length': 
	case 'pieces': 
		return value.info[key];
	case 'creation date': 
		// convert date to the standard Date object
		return new Date(value[key] * 1000);
	case 'announce-list': 
		var input = value['announce-list'];
		var result = [];
		for (var i = 0; i < input.length; i++) {
			// convert a list of lists of strings to 
			// the simple list of strings
			result.push.apply(result, input[i]);
		}
		return result;
	case 'file-names':
		var input = value.info.files;
		if ( ! input ) {
			// torrent contains the single file
			return [value.info.name];
		}
		var result = [];
		for (var i = 0; i < input.length; i++) {
			result.push(input[i].path.join(Bencode.PATH_DELIMITER));
		}
		return result;
	case 'file-sizes': 
		var input = value.info.files;
		if ( ! input ) {
			// torrent contains the single file
			return [value.info.length];
		}
		var result = [];
		for (var i = 0; i < input.length; i++) {
			result.push(input[i].length);
		}
		return result;
	default:
		return value[key];
	}
};

Bencode.PATH_DELIMITER = '\\';

Bencode.stringify = stringify;

Bencode.parse = function(value)
{
	i = 0;
	text = (value || '').toString();
	return parser();
};

Bencode.torrentInfo = function(value, key)
{
	if ( toString.call(value) == '[object String]' ) {
		value = Bencode.parse(value);
	}

	if ( ! value || ! value.info ) {
		return;
	}

	return torrentInfo(value, key);
};

})();


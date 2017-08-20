require('dotenv').config()

var Crawler = require('crawler');
var Algoliasearch = require('algoliasearch');
var Cheerio = require('cheerio');

var algoliaClient = Algoliasearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_SECRET);
var sectionIndex = algoliaClient.initIndex('sections');
var lawIndex = algoliaClient.initIndex('laws');

var fromYear = 1700;
var toYear = (new Date()).getFullYear();

var FINLEX_BASE = 'http://www.finlex.fi';


var lawCount = 0;
var sectionCount = 0;


var parseYearCollection = function($, year, done) {
	$('.doc').each(function(index, elem) {
		var url = FINLEX_BASE + $(this).find('a').attr('href');
		queue({
			uri: url,
			type: 'law',
			law: {
				name: $(this).find('a').text(),
				url: url,
				year: year
			}
		});
	});

	done();
};


var parseLaw = function($, law, done) {
	var $document = $('#document');

	var l = {
		title: $('h3:nth-child(2)').text(),
		given: $('.annettu:first-child').text(),
		url: law.url,
		name: law.name,
		year: law.year,
		objectID: law.name
	};

	lawCount++;
	lawIndex.addObject(l);

	// Find all sections
	var $lastSectionHeader = null;
	$document.find('h5').each(function() {
		if (($(this).attr('id') || '').substr(0,1) === 'P') {
			if ($lastSectionHeader) {
				var title = $lastSectionHeader.text().trim();
				if (title) {

					var content = [];
					$(this).prevUntil($lastSectionHeader, 'p.py').each(function() {

						// Find links, if the link starts with the "#" we want to append the 
						// current page url so it works for use too.
						$(this).find('a').each(function() {
							var href = $(this).attr('href') || '';
							if (href.substr(0,1) === '#') {
								$(this).attr('href', law.url + href);
							}

							$(this).attr('target', '_blank');
						});

						content.unshift('<p>' + $(this).html() + '</p>');
					});

					var section = {
						title: title,
						content: content.join(''),
						url: law.url + '#' + $lastSectionHeader.attr('id').trim(),
						law: l,
						objectID: law.name + '§' + $lastSectionHeader.attr('id').trim()
					};

					sectionCount++;
					sectionIndex.addObject(section);
				}
			}

			$lastSectionHeader = $(this);
		}
	});

	console.log('Laws: ' + lawCount);
	console.log('Sections: ' + sectionCount);
	console.log('Left: ' + c.queueSize);

	done();
};

var c = new Crawler({
    maxConnections : 5,
    jQuery: false,
    callback : function (error, res, done) {
        if(error) {
        	console.log('Failed. ' + res.type + ' ' + error);
        	done();
        }
        else {
            var $ = Cheerio.load(res.body, {decodeEntities: false, normalizeWhitespace: true});

        	if (res.options.type === 'year-collection') {
        		$('.result-pages a').each(function(index, elem) {
        			var url = FINLEX_BASE + $(this).attr('href');
        			queue({
        				uri: url,
        				type: 'year-collection-sub'
        			});
        		});

        		parseYearCollection($, res.options.year, done);
        	}
        	else if (res.options.type === 'year-collection-sub') {
				parseYearCollection($, res.options.year, done);
        	}
        	else if (res.options.type === 'law') {
        		parseLaw($, res.options.law, done);
        	}
        	else {
        		done();
        	}
        }
    }
});

c.on('drain', function() {
    console.log('QUEUE EMPTY');
});

var urls = [];
var queue = function(options) {
	if (urls.includes(options.uri)) {}
	else {
		console.log(options.uri);
		urls.push(options.uri);
		c.queue(options);
	}
};


// Fetch all years
for (var year = fromYear; year <= toYear; year++) {
	var url = FINLEX_BASE + '/fi/laki/ajantasa/'+year+'/';
	queue({
		uri: url,
		type: 'year-collection',
		year: year
	});
}
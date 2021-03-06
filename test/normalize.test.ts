/* tslint:disable:quotemark */
import {assert} from 'chai';
import {defaultConfig, initConfig} from '../src/config';
import * as log from '../src/log';
import {LocalLogger} from '../src/log';
import {normalize, NormalizedSpec, TopLevel, TopLevelSpec} from '../src/spec';

// describe('isStacked()') -- tested as part of stackOffset in stack.test.ts

describe('normalize()', () => {
  describe('normalizeFacetedUnit', () => {
    it('should convert single extended spec with column into a composite spec', () => {
      const spec: any = {
        name: 'faceted',
        width: 123,
        height: 234,
        description: 'faceted spec',
        data: {url: 'data/movies.json'},
        mark: 'point',
        encoding: {
          column: {field: 'MPAA_Rating', type: 'ordinal'},
          x: {field: 'Worldwide_Gross', type: 'quantitative'},
          y: {field: 'US_DVD_Sales', type: 'quantitative'}
        }
      };
      const config = initConfig(spec.config);
      assert.deepEqual(normalize(spec, config), {
        name: 'faceted',
        description: 'faceted spec',
        data: {url: 'data/movies.json'},
        facet: {
          column: {field: 'MPAA_Rating', type: 'ordinal'}
        },
        spec: {
          mark: 'point',
          width: 123,
          height: 234,
          encoding: {
            x: {field: 'Worldwide_Gross', type: 'quantitative'},
            y: {field: 'US_DVD_Sales', type: 'quantitative'}
          }
        }
      });
    });

    it('should convert single extended spec with row into a composite spec', () => {
      const spec: any = {
        data: {url: 'data/movies.json'},
        mark: 'point',
        encoding: {
          row: {field: 'MPAA_Rating', type: 'ordinal'},
          x: {field: 'Worldwide_Gross', type: 'quantitative'},
          y: {field: 'US_DVD_Sales', type: 'quantitative'}
        }
      };

      const config = initConfig(spec.config);
      assert.deepEqual(normalize(spec, config), {
        data: {url: 'data/movies.json'},
        facet: {
          row: {field: 'MPAA_Rating', type: 'ordinal'}
        },
        spec: {
          mark: 'point',
          encoding: {
            x: {field: 'Worldwide_Gross', type: 'quantitative'},
            y: {field: 'US_DVD_Sales', type: 'quantitative'}
          }
        }
      });
    });
  });

  describe('normalizeFacet', () => {
    it('should produce correct layered specs for mean point and vertical error bar', () => {
      assert.deepEqual(
        normalize(
          {
            description:
              'A error bar plot showing mean, min, and max in the US population distribution of age groups in 2000.',
            data: {url: 'data/population.json'},
            transform: [{calculate: "(datum.sex==1) ? 'Men':'Women'", as: 'sex'}],
            facet: {row: {field: 'sex', type: 'ordinal'}},
            spec: {
              layer: [
                {
                  mark: 'errorbar',
                  encoding: {
                    x: {field: 'age', type: 'ordinal'},
                    y: {field: 'people', type: 'quantitative'}
                  }
                },
                {
                  mark: {type: 'point', opacity: 1, filled: true},
                  encoding: {
                    x: {field: 'age', type: 'ordinal'},
                    y: {field: 'people', type: 'quantitative', aggregate: 'mean'}
                  }
                }
              ]
            }
          },
          defaultConfig
        ),
        {
          description:
            'A error bar plot showing mean, min, and max in the US population distribution of age groups in 2000.',
          data: {
            url: 'data/population.json'
          },
          transform: [
            {
              calculate: "(datum.sex==1) ? 'Men':'Women'",
              as: 'sex'
            }
          ],
          facet: {
            row: {
              field: 'sex',
              type: 'ordinal'
            }
          },
          spec: {
            layer: [
              {
                transform: [
                  {
                    aggregate: [
                      {op: 'stderr', field: 'people', as: 'extent_people'},
                      {op: 'mean', field: 'people', as: 'center_people'}
                    ],
                    groupby: ['age']
                  },
                  {
                    calculate: 'datum.center_people + datum.extent_people',
                    as: 'upper_people'
                  },
                  {
                    calculate: 'datum.center_people - datum.extent_people',
                    as: 'lower_people'
                  }
                ],
                layer: [
                  {
                    mark: {type: 'rule', style: 'errorbar-rule'},
                    encoding: {
                      y: {
                        field: 'lower_people',
                        type: 'quantitative',
                        title: 'people'
                      },
                      y2: {field: 'upper_people', type: 'quantitative'},
                      x: {field: 'age', type: 'ordinal', title: 'age'}
                    }
                  }
                ]
              },
              {
                mark: {type: 'point', opacity: 1, filled: true},
                encoding: {
                  x: {field: 'age', type: 'ordinal'},
                  y: {field: 'people', type: 'quantitative', aggregate: 'mean'}
                }
              }
            ]
          }
        }
      );
    });
  });

  describe('normalizeLayer', () => {
    it('correctly passes shared projection and encoding to children of layer', () => {
      const output = normalize(
        {
          data: {url: 'data/population.json'},
          projection: {type: 'mercator'},
          encoding: {
            x: {field: 'age', type: 'ordinal'}
          },
          layer: [
            {mark: 'point'},
            {
              layer: [
                {mark: 'rule'},
                {
                  mark: 'text',
                  encoding: {
                    text: {field: 'a', type: 'nominal'}
                  }
                }
              ]
            }
          ]
        },
        defaultConfig
      );

      assert.deepEqual(output, {
        data: {url: 'data/population.json'},
        layer: [
          {
            projection: {type: 'mercator'},
            mark: 'point',
            encoding: {
              x: {field: 'age', type: 'ordinal'}
            }
          },
          {
            layer: [
              {
                projection: {type: 'mercator'},
                mark: 'rule',
                encoding: {
                  x: {field: 'age', type: 'ordinal'}
                }
              },
              {
                projection: {type: 'mercator'},
                mark: 'text',
                encoding: {
                  x: {field: 'age', type: 'ordinal'},
                  text: {field: 'a', type: 'nominal'}
                }
              }
            ]
          }
        ]
      });
    });

    it(
      'correctly overrides shared projection and encoding and throws warnings',
      log.wrap((localLogger: LocalLogger) => {
        const output = normalize(
          {
            data: {url: 'data/population.json'},
            projection: {type: 'mercator'},
            encoding: {
              x: {field: 'age', type: 'ordinal'}
            },
            layer: [
              {
                projection: {type: 'albersUsa'},
                mark: 'rule'
              },
              {
                mark: 'text',
                encoding: {
                  x: {field: 'a', type: 'nominal'}
                }
              }
            ]
          },
          defaultConfig
        );

        assert.equal(localLogger.warns.length, 2);

        assert.equal(
          localLogger.warns[0],
          log.message.projectionOverridden({
            parentProjection: {type: 'mercator'},
            projection: {type: 'albersUsa'}
          })
        );

        assert.equal(localLogger.warns[1], log.message.encodingOverridden(['x']));

        assert.deepEqual(output, {
          data: {url: 'data/population.json'},
          layer: [
            {
              projection: {type: 'albersUsa'},
              mark: 'rule',
              encoding: {
                x: {field: 'age', type: 'ordinal'}
              }
            },
            {
              projection: {type: 'mercator'},
              mark: 'text',
              encoding: {
                x: {field: 'a', type: 'nominal'}
              }
            }
          ]
        });
      })
    );
  });

  describe('normalizePathOverlay', () => {
    it('correctly normalizes line with overlayed point.', () => {
      const spec: TopLevelSpec = {
        data: {url: 'data/stocks.csv', format: {type: 'csv'}},
        mark: 'line',
        encoding: {
          x: {field: 'date', type: 'temporal'},
          y: {field: 'price', type: 'quantitative'}
        },
        config: {line: {point: {}}}
      };
      const normalizedSpec = normalize(spec, spec.config);
      assert.deepEqual<TopLevel<NormalizedSpec>>(normalizedSpec, {
        data: {url: 'data/stocks.csv', format: {type: 'csv'}},
        layer: [
          {
            mark: 'line',
            encoding: {
              x: {field: 'date', type: 'temporal'},
              y: {field: 'price', type: 'quantitative'}
            }
          },
          {
            mark: {type: 'point', opacity: 1, filled: true},
            encoding: {
              x: {field: 'date', type: 'temporal'},
              y: {field: 'price', type: 'quantitative'}
            }
          }
        ],
        config: {line: {point: {}}}
      });
    });

    it('correctly normalizes line with transparent point overlayed.', () => {
      const spec: TopLevelSpec = {
        data: {url: 'data/stocks.csv', format: {type: 'csv'}},
        mark: {type: 'line', point: 'transparent'},
        encoding: {
          x: {field: 'date', type: 'temporal'},
          y: {field: 'price', type: 'quantitative'}
        }
      };
      const normalizedSpec = normalize(spec, spec.config);
      assert.deepEqual<TopLevel<NormalizedSpec>>(normalizedSpec, {
        data: {url: 'data/stocks.csv', format: {type: 'csv'}},
        layer: [
          {
            mark: 'line',
            encoding: {
              x: {field: 'date', type: 'temporal'},
              y: {field: 'price', type: 'quantitative'}
            }
          },
          {
            mark: {type: 'point', opacity: 0, filled: true},
            encoding: {
              x: {field: 'date', type: 'temporal'},
              y: {field: 'price', type: 'quantitative'}
            }
          }
        ]
      });
    });

    it('correctly normalizes line with point overlayed via mark definition.', () => {
      const spec: TopLevelSpec = {
        data: {url: 'data/stocks.csv', format: {type: 'csv'}},
        mark: {type: 'line', point: {color: 'red'}},
        encoding: {
          x: {field: 'date', type: 'temporal'},
          y: {field: 'price', type: 'quantitative'}
        }
      };
      const normalizedSpec = normalize(spec, spec.config);
      assert.deepEqual<TopLevel<NormalizedSpec>>(normalizedSpec, {
        data: {url: 'data/stocks.csv', format: {type: 'csv'}},
        layer: [
          {
            mark: 'line',
            encoding: {
              x: {field: 'date', type: 'temporal'},
              y: {field: 'price', type: 'quantitative'}
            }
          },
          {
            mark: {type: 'point', opacity: 1, filled: true, color: 'red'},
            encoding: {
              x: {field: 'date', type: 'temporal'},
              y: {field: 'price', type: 'quantitative'}
            }
          }
        ]
      });
    });

    it('correctly normalizes faceted line plots with overlayed point.', () => {
      const spec: TopLevelSpec = {
        data: {url: 'data/stocks.csv', format: {type: 'csv'}},
        mark: 'line',
        encoding: {
          row: {field: 'symbol', type: 'nominal'},
          x: {field: 'date', type: 'temporal'},
          y: {field: 'price', type: 'quantitative'}
        },
        config: {line: {point: {}}}
      };
      const normalizedSpec = normalize(spec, spec.config);
      assert.deepEqual<TopLevel<NormalizedSpec>>(normalizedSpec, {
        data: {url: 'data/stocks.csv', format: {type: 'csv'}},
        facet: {
          row: {field: 'symbol', type: 'nominal'}
        },
        spec: {
          layer: [
            {
              mark: 'line',
              encoding: {
                x: {field: 'date', type: 'temporal'},
                y: {field: 'price', type: 'quantitative'}
              }
            },
            {
              mark: {type: 'point', opacity: 1, filled: true},
              encoding: {
                x: {field: 'date', type: 'temporal'},
                y: {field: 'price', type: 'quantitative'}
              }
            }
          ]
        },
        config: {line: {point: {}}}
      });
    });

    it('correctly normalizes area with overlay line and point', () => {
      const spec: TopLevelSpec = {
        data: {url: 'data/stocks.csv', format: {type: 'csv'}},
        mark: 'area',
        encoding: {
          x: {field: 'date', type: 'temporal'},
          y: {field: 'price', type: 'quantitative'}
        },
        config: {area: {line: {}, point: {}}}
      };
      const normalizedSpec = normalize(spec, spec.config);
      assert.deepEqual<TopLevel<NormalizedSpec>>(normalizedSpec, {
        data: {url: 'data/stocks.csv', format: {type: 'csv'}},
        layer: [
          {
            mark: {type: 'area', opacity: 0.7},
            encoding: {
              x: {field: 'date', type: 'temporal'},
              y: {field: 'price', type: 'quantitative'}
            }
          },
          {
            mark: {type: 'line'},
            encoding: {
              x: {field: 'date', type: 'temporal'},
              y: {field: 'price', type: 'quantitative'}
            }
          },
          {
            mark: {type: 'point', opacity: 1, filled: true},
            encoding: {
              x: {field: 'date', type: 'temporal'},
              y: {field: 'price', type: 'quantitative'}
            }
          }
        ],
        config: {area: {line: {}, point: {}}}
      });
    });

    it('correctly normalizes interpolated area with overlay line', () => {
      const spec: TopLevelSpec = {
        data: {url: 'data/stocks.csv', format: {type: 'csv'}},
        mark: {type: 'area', interpolate: 'monotone'},
        encoding: {
          x: {field: 'date', type: 'temporal'},
          y: {field: 'price', type: 'quantitative'}
        },
        config: {area: {line: {}}}
      };
      const normalizedSpec = normalize(spec, spec.config);
      assert.deepEqual<TopLevel<NormalizedSpec>>(normalizedSpec, {
        data: {url: 'data/stocks.csv', format: {type: 'csv'}},
        layer: [
          {
            mark: {type: 'area', opacity: 0.7, interpolate: 'monotone'},
            encoding: {
              x: {field: 'date', type: 'temporal'},
              y: {field: 'price', type: 'quantitative'}
            }
          },
          {
            mark: {type: 'line', interpolate: 'monotone'},
            encoding: {
              x: {field: 'date', type: 'temporal'},
              y: {field: 'price', type: 'quantitative'}
            }
          }
        ],
        config: {area: {line: {}}}
      });
    });

    it('correctly normalizes area with disabled overlay point and line.', () => {
      for (const overlay of [null, false]) {
        const spec: TopLevelSpec = {
          data: {url: 'data/stocks.csv', format: {type: 'csv'}},
          mark: {type: 'area', point: overlay, line: overlay},
          encoding: {
            x: {field: 'date', type: 'temporal'},
            y: {field: 'price', type: 'quantitative'}
          }
        };
        const normalizedSpec = normalize(spec, spec.config);
        assert.deepEqual<TopLevel<NormalizedSpec>>(normalizedSpec, {
          data: {url: 'data/stocks.csv', format: {type: 'csv'}},
          mark: 'area',
          encoding: {
            x: {field: 'date', type: 'temporal'},
            y: {field: 'price', type: 'quantitative'}
          }
        });
      }
    });

    it('correctly normalizes area with overlay point and line disabled in config.', () => {
      for (const overlay of [null, false]) {
        const spec: TopLevelSpec = {
          data: {url: 'data/stocks.csv', format: {type: 'csv'}},
          mark: {type: 'area'},
          encoding: {
            x: {field: 'date', type: 'temporal'},
            y: {field: 'price', type: 'quantitative'}
          },
          config: {
            area: {point: overlay, line: overlay}
          }
        };
        const normalizedSpec = normalize(spec, spec.config);
        assert.deepEqual<TopLevel<NormalizedSpec>>(normalizedSpec, {
          data: {url: 'data/stocks.csv', format: {type: 'csv'}},
          mark: 'area',
          encoding: {
            x: {field: 'date', type: 'temporal'},
            y: {field: 'price', type: 'quantitative'}
          },
          config: {
            area: {point: overlay, line: overlay}
          }
        });
      }
    });

    it('correctly normalizes stacked area with overlay line', () => {
      const spec: TopLevelSpec = {
        data: {url: 'data/stocks.csv', format: {type: 'csv'}},
        mark: 'area',
        encoding: {
          x: {field: 'date', type: 'temporal'},
          y: {aggregate: 'sum', field: 'price', type: 'quantitative'},
          color: {field: 'symbol', type: 'nominal'}
        },
        config: {area: {line: {}}}
      };
      const normalizedSpec = normalize(spec, spec.config);
      assert.deepEqual<TopLevel<NormalizedSpec>>(normalizedSpec, {
        data: {url: 'data/stocks.csv', format: {type: 'csv'}},
        layer: [
          {
            mark: {type: 'area', opacity: 0.7},
            encoding: {
              x: {field: 'date', type: 'temporal'},
              y: {aggregate: 'sum', field: 'price', type: 'quantitative'},
              color: {field: 'symbol', type: 'nominal'}
            }
          },
          {
            mark: {type: 'line'},
            encoding: {
              x: {field: 'date', type: 'temporal'},
              y: {aggregate: 'sum', field: 'price', type: 'quantitative', stack: 'zero'},
              color: {field: 'symbol', type: 'nominal'}
            }
          }
        ],
        config: {area: {line: {}}}
      });
    });

    it('correctly normalizes streamgraph with overlay line', () => {
      const spec: TopLevelSpec = {
        data: {url: 'data/stocks.csv', format: {type: 'csv'}},
        mark: 'area',
        encoding: {
          x: {field: 'date', type: 'temporal'},
          y: {aggregate: 'sum', field: 'price', type: 'quantitative', stack: 'center'},
          color: {field: 'symbol', type: 'nominal'}
        },
        config: {area: {line: {}}}
      };
      const normalizedSpec = normalize(spec, spec.config);
      assert.deepEqual<TopLevel<NormalizedSpec>>(normalizedSpec, {
        data: {url: 'data/stocks.csv', format: {type: 'csv'}},
        layer: [
          {
            mark: {type: 'area', opacity: 0.7},
            encoding: {
              x: {field: 'date', type: 'temporal'},
              y: {aggregate: 'sum', field: 'price', type: 'quantitative', stack: 'center'},
              color: {field: 'symbol', type: 'nominal'}
            }
          },
          {
            mark: {type: 'line'},
            encoding: {
              x: {field: 'date', type: 'temporal'},
              y: {aggregate: 'sum', field: 'price', type: 'quantitative', stack: 'center'},
              color: {field: 'symbol', type: 'nominal'}
            }
          }
        ],
        config: {area: {line: {}}}
      });
    });
  });

  describe('normalizeRangedUnitSpec', () => {
    it('should convert y2 -> y if there is no y in the encoding', () => {
      const spec: NormalizedSpec = {
        data: {url: 'data/population.json'},
        mark: 'rule',
        encoding: {
          y2: {field: 'age', type: 'ordinal'},
          x: {aggregate: 'min', field: 'people', type: 'quantitative'},
          x2: {aggregate: 'max', field: 'people', type: 'quantitative'}
        }
      };

      assert.deepEqual<NormalizedSpec>(normalize(spec, defaultConfig), {
        data: {url: 'data/population.json'},
        mark: 'rule',
        encoding: {
          y: {field: 'age', type: 'ordinal'},
          x: {aggregate: 'min', field: 'people', type: 'quantitative'},
          x2: {aggregate: 'max', field: 'people', type: 'quantitative'}
        }
      });
    });
    it('should do nothing if there is no missing x or y', () => {
      const spec: NormalizedSpec = {
        data: {url: 'data/population.json'},
        mark: 'rule',
        encoding: {
          y: {field: 'age', type: 'ordinal'},
          x: {aggregate: 'min', field: 'people', type: 'quantitative'},
          x2: {aggregate: 'max', field: 'people', type: 'quantitative'}
        }
      };

      assert.deepEqual(normalize(spec, defaultConfig), spec);
    });

    it('should convert x2 -> x if there is no x in the encoding', () => {
      const spec: NormalizedSpec = {
        data: {url: 'data/population.json'},
        mark: 'rule',
        encoding: {
          x2: {field: 'age', type: 'ordinal'},
          y: {aggregate: 'min', field: 'people', type: 'quantitative'},
          y2: {aggregate: 'max', field: 'people', type: 'quantitative'}
        }
      };

      assert.deepEqual<NormalizedSpec>(normalize(spec, defaultConfig), {
        data: {url: 'data/population.json'},
        mark: 'rule',
        encoding: {
          x: {field: 'age', type: 'ordinal'},
          y: {aggregate: 'min', field: 'people', type: 'quantitative'},
          y2: {aggregate: 'max', field: 'people', type: 'quantitative'}
        }
      });
    });
  });
});
